import test from "node:test"
import assert from "node:assert/strict"
import app from "@/src/server/routes/articles"
import { repository } from "@/src/server/repositories"

test("DELETE /bulk 会批量删除选中的文章", async (context) => {
  const deletedIds: string[] = []

  context.mock.method(repository, "getArticle", (_userId: string, articleId: string) => ({
    id: articleId,
    userId: "user-1",
    favorite: false,
    sourceId: articleId === "manual-1" ? "manual" : "source-1",
    title: `文章 ${articleId}`,
    sourceUrl: `https://example.com/${articleId}`,
    channelName: "Example",
    channelIcon: "",
    topics: [],
    summary: "",
    content: [],
    readProgress: 0,
    highlightCount: 0,
    status: "ready"
  } as any))
  context.mock.method(repository, "deleteArticle", (_userId: string, articleId: string) => {
    deletedIds.push(articleId)
    return null
  })

  const response = await app.request("/bulk", {
    method: "DELETE",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      ids: ["article-1", "manual-1"]
    })
  })

  assert.equal(response.status, 200)
  assert.deepEqual(deletedIds, ["article-1", "manual-1"])
  assert.equal((await response.json()).deletedCount, 2)
})
