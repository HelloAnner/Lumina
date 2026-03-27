/**
 * 手动导入文章服务测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import type { ScoutArticle } from "@/src/server/store/types"
import { ArticleImportError, importArticleFromUrl } from "./manual-import"

function buildArticle(overrides: Partial<ScoutArticle> = {}): ScoutArticle {
  return {
    id: "article-1",
    userId: "user-1",
    entryId: "entry-1",
    sourceId: "manual",
    title: "Existing article",
    sourceUrl: "https://example.com/post",
    channelName: "example.com",
    channelIcon: "",
    topics: [],
    summary: "summary",
    content: [{ id: "p1", type: "paragraph", text: "hello" }],
    readProgress: 0,
    highlightCount: 0,
    status: "ready",
    createdAt: "2026-03-26T00:00:00.000Z",
    ...overrides
  }
}

test("importArticleFromUrl 在 URL 已存在时直接返回已有文章", async () => {
  const existing = buildArticle({
    sourceUrl: "https://example.com/post?utm_source=rss"
  })

  const result = await importArticleFromUrl(
    { userId: "user-1", url: "https://example.com/post?utm_source=feed" },
    {
      findArticleBySourceUrl: (userId, sourceUrl) => {
        assert.equal(userId, "user-1")
        assert.equal(sourceUrl, "https://example.com/post")
        return existing
      },
      createArticle: () => {
        throw new Error("should not create")
      },
      fetchAndExtract: async () => {
        throw new Error("should not fetch")
      },
      createEntryId: () => "entry-new",
      createArticleId: () => "article-new",
      persistArticleAssets: async () => ({
        content: [],
        coverImage: undefined
      })
    }
  )

  assert.equal(result.status, "existing")
  assert.equal(result.item.id, existing.id)
})

test("importArticleFromUrl 会归一化 x 状态链接上的分享参数", async () => {
  const existing = buildArticle({
    sourceUrl: "https://x.com/AlchainHust/status/2037183105602109498"
  })

  const result = await importArticleFromUrl(
    {
      userId: "user-1",
      url: "https://x.com/AlchainHust/status/2037183105602109498?s=20&t=lumina-share"
    },
    {
      findArticleBySourceUrl: (userId, sourceUrl) => {
        assert.equal(userId, "user-1")
        assert.equal(sourceUrl, "https://x.com/AlchainHust/status/2037183105602109498")
        return existing
      },
      createArticle: () => {
        throw new Error("should not create")
      },
      fetchAndExtract: async () => {
        throw new Error("should not fetch")
      },
      createEntryId: () => "entry-new",
      createArticleId: () => "article-new",
      persistArticleAssets: async () => ({
        content: [],
        coverImage: undefined
      })
    }
  )

  assert.equal(result.status, "existing")
  assert.equal(result.item.id, existing.id)
})

test("importArticleFromUrl 在正文提取成功时创建新文章", async () => {
  let createdEntryId = ""
  let createdSourceUrl = ""
  let createdChannelName = ""
  let createdTitle = ""
  let createdSummary = ""
  let createdStatus: ScoutArticle["status"] | "" = ""
  let createdPublishedAt: string | undefined

  const result = await importArticleFromUrl(
    { userId: "user-1", url: "https://www.example.com/post/?utm_source=feed#top" },
    {
      findArticleBySourceUrl: () => null,
      fetchAndExtract: async (url) => {
        assert.equal(url, "https://www.example.com/post")
        return {
          title: "A calm article",
          author: "Lumina",
          summary: "A gentle summary",
          siteName: "Example Weekly",
          publishedAt: "2026-03-24T06:30:00.000Z",
          coverImage: "https://cdn.example.com/cover.jpg",
          content: [
            { id: "h1", type: "heading", level: 1, text: "A calm article" },
            { id: "p1", type: "paragraph", text: "Body" }
          ]
        }
      },
      createArticle: (input) => {
        createdEntryId = input.entryId
        createdSourceUrl = input.sourceUrl
        createdChannelName = input.channelName
        createdTitle = input.title
        createdSummary = input.summary
        createdPublishedAt = input.publishedAt
        createdStatus = input.status
        return buildArticle({
          ...input,
          id: "article-new",
          createdAt: "2026-03-26T08:00:00.000Z"
        })
      },
      createEntryId: () => "manual-entry",
      createArticleId: () => "article-new",
      persistArticleAssets: async ({ content, coverImage }) => ({
        content,
        coverImage
      })
    }
  )

  assert.equal(result.status, "created")
  assert.equal(result.item.id, "article-new")
  assert.equal(createdEntryId, "manual-entry")
  assert.equal(createdSourceUrl, "https://www.example.com/post")
  assert.equal(createdChannelName, "Example Weekly")
  assert.equal(createdTitle, "A calm article")
  assert.equal(createdSummary, "A gentle summary")
  assert.equal(createdPublishedAt, "2026-03-24T06:30:00.000Z")
  assert.equal(createdStatus, "ready")
})

test("importArticleFromUrl 在正文提取失败时返回 extract_failed", async () => {
  await assert.rejects(
    () =>
      importArticleFromUrl(
        { userId: "user-1", url: "https://example.com/post" },
        {
          findArticleBySourceUrl: () => null,
          fetchAndExtract: async () => null,
          createArticle: () => {
            throw new Error("should not create")
          },
          createEntryId: () => "entry-new",
          createArticleId: () => "article-new",
          persistArticleAssets: async () => ({
            content: [],
            coverImage: undefined
          })
        }
      ),
    (error: unknown) =>
      error instanceof ArticleImportError &&
      error.code === "extract_failed"
  )
})
