/**
 * 阅读进度快照工具测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import type { Book, ScoutArticle } from "@/src/server/store/types"
import {
  buildArticleProgressSnapshot,
  buildBookProgressSnapshot,
  buildReadingProgressId,
  resolveArticleProgressSectionIndex,
  resolveBookProgressSectionIndex
} from "./progress"

function buildBook(): Book {
  return {
    id: "book-1",
    userId: "user-1",
    title: "Calm Book",
    format: "EPUB",
    filePath: "/tmp/book.epub",
    readProgress: 0,
    tags: [],
    status: "READY",
    synopsis: "",
    toc: [],
    content: [
      { id: "section-1", title: "Start", pageIndex: 1, content: "A" },
      { id: "section-2", title: "Middle", pageIndex: 18, content: "B" }
    ],
    createdAt: "2026-03-26T00:00:00.000Z"
  }
}

function buildArticle(): ScoutArticle {
  return {
    id: "article-1",
    userId: "user-1",
    entryId: "entry-1",
    sourceId: "manual",
    title: "Calm Article",
    sourceUrl: "https://example.com/post",
    channelName: "Example",
    channelIcon: "",
    topics: [],
    summary: "summary",
    content: [
      { id: "sec-1", type: "paragraph", text: "First" },
      { id: "sec-2", type: "paragraph", text: "Second" }
    ],
    readProgress: 0,
    highlightCount: 0,
    status: "ready",
    createdAt: "2026-03-26T00:00:00.000Z"
  }
}

test("buildReadingProgressId 生成稳定的资源进度 id", () => {
  assert.equal(buildReadingProgressId("book", "book-1"), "book-progress-book-1")
  assert.equal(buildReadingProgressId("article", "article-1"), "article-progress-article-1")
})

test("buildBookProgressSnapshot 记录当前页面 id 与页面序号", () => {
  const snapshot = buildBookProgressSnapshot(buildBook(), 1, 3, 0.42, "zh-CN")

  assert.equal(snapshot.id, "book-progress-book-1")
  assert.equal(snapshot.currentPageId, "section-2")
  assert.equal(snapshot.currentPageIndex, 18)
  assert.equal(snapshot.currentSectionIndex, 1)
  assert.equal(snapshot.currentParagraphIndex, 3)
  assert.equal(snapshot.targetLanguage, "zh-CN")
})

test("resolveBookProgressSectionIndex 优先按页面 id 恢复位置", () => {
  const index = resolveBookProgressSectionIndex(buildBook(), {
    currentPageId: "section-2",
    currentPageIndex: 18,
    currentSectionIndex: 0
  })

  assert.equal(index, 1)
})

test("buildArticleProgressSnapshot 记录正文块页面 id 与顺序", () => {
  const snapshot = buildArticleProgressSnapshot(buildArticle(), 1, 0.5)

  assert.equal(snapshot.id, "article-progress-article-1")
  assert.equal(snapshot.currentPageId, "sec-2")
  assert.equal(snapshot.currentPageIndex, 2)
  assert.equal(snapshot.progress, 0.5)
})

test("resolveArticleProgressSectionIndex 优先按页面 id 恢复正文块位置", () => {
  const index = resolveArticleProgressSectionIndex(buildArticle(), {
    currentPageId: "sec-2",
    currentPageIndex: 1
  })

  assert.equal(index, 1)
})
