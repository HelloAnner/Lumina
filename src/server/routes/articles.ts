/**
 * 文章路由
 * 管理互联网文章库、主题分类和文章高亮
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import { syncPendingHighlights } from "@/src/server/services/aggregation/highlight-sync"

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

  const item = repository.createArticleTopic(c.get("userId"), payload)
  return c.json({ item }, 201)
})

app.put("/topics/:id", async (c) => {
  const payload = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    sortOrder: z.number().optional()
  }).parse(await c.req.json())

  const item = repository.updateArticleTopic(c.get("userId"), c.req.param("id"), payload)
  if (!item) {
    return c.json({ error: "Topic not found" }, 404)
  }
  return c.json({ item })
})

app.delete("/topics/:id", (c) => {
  repository.deleteArticleTopic(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

// ─── 文章 ───

app.get("/", (c) => {
  const { topicId, search, filter, page, pageSize } = c.req.query()
  const result = repository.listArticles(c.get("userId"), {
    topicId,
    search,
    filter,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined
  })
  return c.json(result)
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
    topics: z.array(z.string()).optional(),
    archived: z.boolean().optional()
  }).parse(await c.req.json())

  const item = repository.updateArticle(c.get("userId"), c.req.param("id"), payload)
  if (!item) {
    return c.json({ error: "Article not found" }, 404)
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

  const updated = repository.updateArticle(userId, article.id, {
    title: extracted.title || article.title,
    author: extracted.author || article.author,
    content: extracted.content,
    summary: extracted.summary || article.summary,
    siteName: extracted.siteName,
    coverImage: extracted.coverImage
  })

  return c.json({ item: updated })
})

/** 删除即归档：将文章移入归档态，不丢数据 */
app.delete("/:id", (c) => {
  const item = repository.updateArticle(c.get("userId"), c.req.param("id"), { archived: true })
  if (!item) {
    return c.json({ error: "Article not found" }, 404)
  }
  return c.json({ item })
})

/** 从归档恢复到活跃态 */
app.post("/:id/restore", (c) => {
  const item = repository.updateArticle(c.get("userId"), c.req.param("id"), { archived: false })
  if (!item) {
    return c.json({ error: "Article not found" }, 404)
  }
  return c.json({ item })
})

/** 永久删除：仅归档文章可用，不可恢复 */
app.delete("/:id/permanent", (c) => {
  const userId = c.get("userId")
  const articleId = c.req.param("id")
  const article = repository.getArticle(userId, articleId)
  if (!article) {
    return c.json({ error: "Article not found" }, 404)
  }
  if (!article.archived) {
    return c.json({ error: "Only archived articles can be permanently deleted" }, 400)
  }
  repository.deleteArticle(userId, articleId)
  return c.json({ ok: true })
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

  return c.json({ item }, 201)
})

export default app
