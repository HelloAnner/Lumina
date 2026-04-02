/**
 * 文章路由
 * 管理互联网文章库、手动导入、主题分类和文章高亮
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import { invalidateArticles } from "@/src/server/repositories/cached"
import { syncPendingHighlights } from "@/src/server/services/aggregation/highlight-sync"
import {
  findArticleImageSection,
  persistArticleAssets,
  removeArticleAssets
} from "@/src/server/services/articles/assets"
import { autoTagFavoritedArticle } from "@/src/server/services/articles/favorite-tags"
import {
  ArticleImportError,
  importArticleFromUrl
} from "@/src/server/services/articles/manual-import"
import {
  getArticleReaderProgress,
  saveArticleReaderProgress
} from "@/src/server/services/articles/progress"
import {
  getBookObjectBuffer,
  getStoredObjectContentType
} from "@/src/server/services/books/minio"

const app = new Hono<AppEnv>()

// ─── 主题 ───

app.get("/topics", (c) => {
  const items = repository.listArticleTopics(c.get("userId"))
  return c.json({ items })
})

app.post("/topics", async (c) => {
  const payload = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    sortOrder: z.number().int().default(0)
  }).parse(await c.req.json())

  const userId = c.get("userId")
  const item = repository.createArticleTopic(userId, payload)
  void invalidateArticles(userId)
  return c.json({ item }, 201)
})

app.put("/topics/:id", async (c) => {
  const payload = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    sortOrder: z.number().optional()
  }).parse(await c.req.json())

  const userId = c.get("userId")
  const item = repository.updateArticleTopic(userId, c.req.param("id"), payload)
  if (!item) {
    return c.json({ error: "Topic not found" }, 404)
  }
  void invalidateArticles(userId)
  return c.json({ item })
})

app.delete("/topics/:id", (c) => {
  const userId = c.get("userId")
  repository.deleteArticleTopic(userId, c.req.param("id"))
  void invalidateArticles(userId)
  return c.json({ ok: true })
})

// ─── 文章 ───

app.get("/", (c) => {
  const userId = c.get("userId")
  const { topicId, sourceId, search, filter, sortBy, page, pageSize } = c.req.query()

  // 请求驱动：自动归档已读完文章 + 清理过期归档
  const user = repository.getUserById(userId)
  const autoArchiveDays = user?.autoArchiveAfterDays ?? 3
  if (autoArchiveDays > 0) {
    repository.autoArchiveFinished(userId, autoArchiveDays)
  }
  const retentionDays = user?.archiveRetentionDays ?? 30
  if (retentionDays > 0) {
    const purged = repository.purgeExpiredArchives(userId, retentionDays)
    void Promise.all(purged.map((item) => removeArticleAssets(item))).catch(() => undefined)
  }

  const result = repository.listArticles(userId, {
    topicId,
    sourceId,
    search,
    filter,
    sortBy,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined
  })
  return c.json(result)
})

app.post("/import", async (c) => {
  const payload = z.object({
    url: z.string().trim().min(1)
  }).parse(await c.req.json())

  const userId = c.get("userId")
  try {
    const result = await importArticleFromUrl({
      userId,
      url: payload.url
    })
    void invalidateArticles(userId)
    return c.json(result, result.status === "created" ? 201 : 200)
  } catch (error) {
    if (error instanceof ArticleImportError) {
      return c.json({ error: error.message, code: error.code }, 400)
    }
    return c.json({ error: "文章解析失败" }, 502)
  }
})

app.delete("/bulk", async (c) => {
  const payload = z.object({
    ids: z.array(z.string().min(1)).min(1)
  }).parse(await c.req.json())

  const userId = c.get("userId")
  let deletedCount = 0

  for (const articleId of payload.ids) {
    const article = repository.getArticle(userId, articleId)
    if (!article) {
      continue
    }
    await removeArticleAssets(article)
    repository.deleteArticle(userId, articleId)
    deletedCount += 1
  }

  void invalidateArticles(userId)
  return c.json({ ok: true, deletedCount })
})

app.get("/:id", (c) => {
  const item = repository.getArticle(c.get("userId"), c.req.param("id"))
  if (!item) {
    return c.json({ error: "Article not found" }, 404)
  }
  return c.json({ item })
})

app.put("/:id", async (c) => {
  const payload = z.object({
    readProgress: z.number().optional(),
    lastReadPosition: z.string().optional(),
    lastReadAt: z.string().optional(),
    reading: z.boolean().optional(),
    topics: z.array(z.string()).optional(),
    archived: z.boolean().optional(),
    translationView: z.enum(["original", "translation"]).optional(),
    translatedTitle: z.string().optional()
  }).parse(await c.req.json())

  const userId = c.get("userId")
  const articleId = c.req.param("id")
  const item = repository.updateArticle(userId, articleId, payload)
  if (!item) {
    return c.json({ error: "Article not found" }, 404)
  }
  void invalidateArticles(userId)

  // 切换到翻译视图时，后台异步触发翻译（即使用户退出阅读也能完成）
  if (payload.translationView === "translation" && item.content?.length > 0) {
    const { prefetchArticleTranslations } = await import("@/src/server/services/translation/service")
    const model = repository.getModelByFeature(userId, "section_translate")
    void prefetchArticleTranslations({
      userId,
      articleId,
      title: item.title,
      sections: item.content,
      model
    }).catch(() => undefined)
  }

  return c.json({ item })
})

app.post("/:id/refetch", async (c) => {
  const userId = c.get("userId")
  const article = repository.getArticle(userId, c.req.param("id"))
  if (!article) {
    return c.json({ error: "Article not found" }, 404)
  }
  if (!article.sourceUrl) {
    return c.json({ error: "No source URL" }, 400)
  }

  const { fetchAndExtract } = await import("@/src/server/services/scout/content-extractor")
  const extracted = await fetchAndExtract(article.sourceUrl)
  if (!extracted) {
    return c.json({ error: "Failed to extract content" }, 502)
  }
  await removeArticleAssets(article)
  repository.clearArticleDerivedData(userId, article.id, {
    keepShareLinks: true
  })
  const withAssets = await persistArticleAssets({
    userId,
    articleId: article.id,
    content: extracted.content,
    coverImage: extracted.coverImage
  })

  const updated = repository.updateArticle(userId, article.id, {
    title: extracted.title || article.title,
    author: extracted.author || article.author,
    publishedAt: extracted.publishedAt ?? article.publishedAt,
    content: withAssets.content,
    summary: extracted.summary || article.summary,
    siteName: extracted.siteName,
    coverImage: withAssets.coverImage,
    highlightCount: 0,
    translationView: "original",
    translatedTitle: "",
    readProgress: 0
  })
  void invalidateArticles(userId)

  return c.json({ item: updated })
})

app.get("/:id/progress", async (c) => {
  const article = repository.getArticle(c.get("userId"), c.req.param("id"))
  const progress = await getArticleReaderProgress(c.get("userId"), c.req.param("id"))
  return c.json({
    id: progress.id,
    progress: article?.readProgress ?? progress.progress ?? 0,
    currentPageId: progress.currentPageId,
    currentPageIndex: progress.currentPageIndex
  })
})

app.put("/:id/progress", async (c) => {
  const payload = z.object({
    id: z.string().optional(),
    progress: z.number().min(0).max(1),
    currentPageId: z.string().optional(),
    currentPageIndex: z.number().min(0).optional()
  }).parse(await c.req.json())

  const userId = c.get("userId")
  const updatedArticle = repository.updateArticle(userId, c.req.param("id"), {
    readProgress: payload.progress,
    lastReadAt: new Date().toISOString(),
    lastReadPosition: payload.currentPageId ?? undefined
  })
  void invalidateArticles(userId)
  const progress = await saveArticleReaderProgress(userId, c.req.param("id"), {
    id: payload.id,
    progress: payload.progress,
    currentPageId: payload.currentPageId,
    currentPageIndex: payload.currentPageIndex
  })

  return c.json({ item: updatedArticle, progress })
})

app.post("/:id/favorite", async (c) => {
  const userId = c.get("userId")
  const articleId = c.req.param("id")
  const article = repository.getArticle(userId, articleId)
  if (!article) {
    return c.json({ error: "Article not found" }, 404)
  }
  const item = repository.updateArticle(userId, articleId, {
    favorite: true,
    favoritedAt: new Date().toISOString()
  })
  void autoTagFavoritedArticle(userId, articleId).catch(() => undefined)
  void invalidateArticles(userId)
  return c.json({ item })
})

app.post("/:id/unfavorite", async (c) => {
  const userId = c.get("userId")
  const articleId = c.req.param("id")
  const article = repository.getArticle(userId, articleId)
  if (!article) {
    return c.json({ error: "Article not found" }, 404)
  }
  const item = repository.updateArticle(userId, articleId, {
    favorite: false,
    favoritedAt: undefined
  })
  void invalidateArticles(userId)
  return c.json({ item })
})

/** 删除即归档：将文章移入归档态，不丢数据 */
app.delete("/:id", (c) => {
  const userId = c.get("userId")
  const item = repository.updateArticle(userId, c.req.param("id"), {
    archived: true,
    archivedAt: new Date().toISOString()
  })
  if (!item) {
    return c.json({ error: "Article not found" }, 404)
  }
  void invalidateArticles(userId)
  return c.json({ item })
})

/** 从归档恢复到活跃态 */
app.post("/:id/restore", (c) => {
  const userId = c.get("userId")
  const item = repository.updateArticle(userId, c.req.param("id"), { archived: false })
  if (!item) {
    return c.json({ error: "Article not found" }, 404)
  }
  void invalidateArticles(userId)
  return c.json({ item })
})

/** 永久删除：仅归档文章可用，不可恢复 */
app.delete("/:id/permanent", async (c) => {
  const userId = c.get("userId")
  const articleId = c.req.param("id")
  const article = repository.getArticle(userId, articleId)
  if (!article) {
    return c.json({ error: "Article not found" }, 404)
  }
  if (!article.archived) {
    return c.json({ error: "Only archived articles can be permanently deleted" }, 400)
  }
  if (article.favorite) {
    return c.json({ error: "收藏文章不能删除，请先取消收藏" }, 400)
  }
  await removeArticleAssets(article)
  repository.deleteArticle(userId, articleId)
  void invalidateArticles(userId)
  return c.json({ ok: true })
})

app.get("/:id/assets/:assetId", async (c) => {
  const userId = c.get("userId")
  const article = repository.getArticle(userId, c.req.param("id"))
  if (!article) {
    return c.json({ error: "Article not found" }, 404)
  }
  const imageSection = findArticleImageSection(article, c.req.param("assetId"))
  if (!imageSection?.objectKey) {
    return c.json({ error: "Asset not found" }, 404)
  }
  const buffer = await getBookObjectBuffer("lumina-books", imageSection.objectKey)
  if (!buffer) {
    return c.json({ error: "Asset not found" }, 404)
  }
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=900",
      "Content-Type": getStoredObjectContentType(imageSection.objectKey)
    }
  })
})

// ─── 文章高亮 ───

app.get("/:id/highlights", (c) => {
  const userId = c.get("userId")
  const articleId = c.req.param("id")
  const article = repository.getArticle(userId, articleId)
  if (!article) {
    return c.json({ error: "Article not found" }, 404)
  }
  /** 复用书籍高亮系统，通过 sourceType + articleId 过滤 */
  const all = repository.listHighlightsByBook(userId, articleId)
  return c.json({ items: all })
})

app.post("/:id/highlights", async (c) => {
  const userId = c.get("userId")
  const articleId = c.req.param("id")

  const article = repository.getArticle(userId, articleId)
  if (!article) {
    return c.json({ error: "Article not found" }, 404)
  }

  const payload = z.object({
    content: z.string(),
    note: z.string().optional(),
    color: z.enum(["yellow", "green", "blue", "pink"]).default("yellow"),
    contentMode: z.enum(["original", "translation"]).default("original"),
    targetLanguage: z.string().optional(),
    counterpartContent: z.string().optional(),
    counterpartParaOffsetStart: z.number().optional(),
    counterpartParaOffsetEnd: z.number().optional(),
    paraOffsetStart: z.number().optional(),
    paraOffsetEnd: z.number().optional(),
    pageIndex: z.number().optional()
  }).parse(await c.req.json())

  const item = repository.createHighlight({
    userId,
    bookId: articleId,
    format: "EPUB",
    sourceType: "article",
    articleId,
    contentMode: payload.contentMode,
    targetLanguage: payload.targetLanguage,
    counterpartContent: payload.counterpartContent,
    counterpartParaOffsetStart: payload.counterpartParaOffsetStart,
    counterpartParaOffsetEnd: payload.counterpartParaOffsetEnd,
    content: payload.content,
    note: payload.note,
    color: payload.color,
    paraOffsetStart: payload.paraOffsetStart,
    paraOffsetEnd: payload.paraOffsetEnd,
    pageIndex: payload.pageIndex
  })

  /** 更新文章高亮计数 */
  repository.updateArticle(userId, articleId, {
    highlightCount: article.highlightCount + 1
  })

  /** 异步同步高亮到知识库 */
  void syncPendingHighlights(userId).catch(() => undefined)
  void invalidateArticles(userId)

  return c.json({ item }, 201)
})

export default app
