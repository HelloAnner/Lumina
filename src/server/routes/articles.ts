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
  const { topicId, search } = c.req.query()
  const items = repository.listArticles(c.get("userId"), topicId, search)
  return c.json({ items })
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
    topics: z.array(z.string()).optional()
  }).parse(await c.req.json())

  const item = repository.updateArticle(c.get("userId"), c.req.param("id"), payload)
  if (!item) {
    return c.json({ error: "Article not found" }, 404)
  }
  return c.json({ item })
})

app.delete("/:id", (c) => {
  repository.deleteArticle(c.get("userId"), c.req.param("id"))
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
    contentMode: "original",
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

  return c.json({ item }, 201)
})

export default app
