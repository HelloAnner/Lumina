/**
 * 文章收藏路由测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import app from "@/src/server/routes/articles"
import { repository } from "@/src/server/repositories"

test("POST /:id/favorite 会标记收藏", async (context) => {
  context.mock.method(repository, "updateArticle", () => ({
    id: "article-1",
    userId: "user-1",
    favorite: true
  } as any))
  context.mock.method(repository, "getArticle", () => ({
    id: "article-1",
    userId: "user-1",
    title: "文章",
    topics: [],
    content: [],
    highlightCount: 0
  } as any))
  context.mock.method(repository, "listHighlightsByBook", () => [])
  context.mock.method(repository, "listArticleTopics", () => [])

  const response = await app.request("/article-1/favorite", { method: "POST" })

  assert.equal(response.status, 200)
  assert.equal((await response.json()).item.favorite, true)
})

test("DELETE /:id/permanent 会拒绝删除已收藏文章", async (context) => {
  context.mock.method(repository, "getArticle", () => ({
    id: "article-1",
    userId: "user-1",
    archived: true,
    favorite: true
  } as any))

  const response = await app.request("/article-1/permanent", { method: "DELETE" })

  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /收藏/)
})
