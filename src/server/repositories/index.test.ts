/**
 * 本地仓库书籍创建测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("repository.createBook 保留传入的书籍 id", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-repo-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const demo = repository.getUserByEmail(
      process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
    )

    assert.ok(demo, "应存在默认演示账号")

    const created = repository.createBook({
      id: "book-fixed-id",
      userId: demo!.id,
      title: "封面流程测试",
      author: "Lumina",
      format: "EPUB",
      filePath: "minio://lumina-books/books/user-1/book-fixed-id/demo.epub",
      coverPath: "minio://lumina-covers/user-1/book-fixed-id.jpg",
      totalPages: 1,
      readProgress: 0,
      lastReadAt: new Date().toISOString(),
      tags: ["测试"],
      status: "READY",
      synopsis: "测试",
      toc: [],
      content: []
    } as any)

    assert.equal(created.id, "book-fixed-id")
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("repository.createHighlight 默认原文模式，允许保存译文模式高亮", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-highlight-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("@/src/server/repositories")

  try {
    const demo = repository.getUserByEmail(
      process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
    )

    assert.ok(demo, "应存在默认演示账号")

    const book = repository.listBooks(demo!.id)[0]
    assert.ok(book, "应存在默认演示书籍")

    const originalHighlight = repository.createHighlight({
      userId: demo!.id,
      bookId: book.id,
      format: "EPUB",
      pageIndex: 1,
      content: "原文片段",
      color: "yellow"
    } as any)

    const translatedHighlight = repository.createHighlight({
      userId: demo!.id,
      bookId: book.id,
      format: "EPUB",
      pageIndex: 1,
      contentMode: "translation",
      targetLanguage: "zh-CN",
      content: "译文片段",
      counterpartContent: "Original snippet",
      counterpartParaOffsetStart: 3,
      counterpartParaOffsetEnd: 11,
      color: "blue"
    } as any)

    const items = repository.listHighlightsByBook(demo!.id, book.id)

    assert.equal(
      items.find((item) => item.id === originalHighlight.id)?.contentMode,
      "original"
    )
    assert.equal(
      items.find((item) => item.id === translatedHighlight.id)?.contentMode,
      "translation"
    )
    assert.equal(
      items.find((item) => item.id === translatedHighlight.id)?.content,
      "译文片段"
    )
    assert.equal(
      items.find((item) => item.id === translatedHighlight.id)?.counterpartContent,
      "Original snippet"
    )
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})
