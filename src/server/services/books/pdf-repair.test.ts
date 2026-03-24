/**
 * PDF 占位正文修复测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import test from "node:test"
import assert from "node:assert/strict"
import type { Book } from "@/src/server/store/types"
import type { HardParsedBookMetadata } from "@/src/server/services/books/metadata"
import {
  PDF_UPLOAD_PLACEHOLDER_TEXT,
  buildRepairedPdfBookUpdates,
  needsPdfTextRepair,
  repairPlaceholderPdfBook
} from "@/src/server/services/books/pdf-repair"

function createPdfBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-1",
    userId: "user-1",
    title: "sample",
    author: "未知作者",
    format: "PDF",
    filePath: "minio://lumina-books/books/user-1/book-1/sample.pdf",
    coverPath: "",
    totalPages: 1,
    readProgress: 0,
    lastReadAt: "",
    tags: ["PDF"],
    status: "READY",
    synopsis: PDF_UPLOAD_PLACEHOLDER_TEXT,
    toc: [{ id: "toc-1", title: "导入文档", pageIndex: 1 }],
    content: [
      {
        id: "section-1",
        title: "导入文档",
        pageIndex: 1,
        content: PDF_UPLOAD_PLACEHOLDER_TEXT
      }
    ],
    createdAt: "2026-03-24T00:00:00.000Z",
    ...overrides
  }
}

function createParsedMetadata(overrides: Partial<HardParsedBookMetadata> = {}): HardParsedBookMetadata {
  return {
    title: "Coding Agent is All You Need",
    author: "Kelly Peilin Chan",
    format: "PDF",
    tags: ["AI", "Agent"],
    sections: [
      {
        id: "parsed-1",
        title: "Abstract",
        pageIndex: 1,
        content: "Building AI agents is hard."
      }
    ],
    totalPages: 19,
    synopsis: "Building AI agents is hard.",
    toc: [{ id: "parsed-toc-1", title: "Abstract", pageIndex: 1 }],
    ...overrides
  }
}

test("needsPdfTextRepair 仅在 PDF 占位正文时返回 true", () => {
  assert.equal(needsPdfTextRepair(createPdfBook()), true)
  assert.equal(
    needsPdfTextRepair(
      createPdfBook({
        content: [
          {
            id: "section-1",
            title: "Abstract",
            pageIndex: 1,
            content: "Building AI agents is hard."
          }
        ]
      })
    ),
    false
  )
  assert.equal(needsPdfTextRepair(createPdfBook({ format: "EPUB" })), false)
})

test("buildRepairedPdfBookUpdates 会优先用真实解析结果替换默认占位字段", () => {
  const updates = buildRepairedPdfBookUpdates(
    createPdfBook(),
    createParsedMetadata(),
    "sample.pdf"
  )

  assert.equal(updates.title, "Coding Agent is All You Need")
  assert.equal(updates.author, "Kelly Peilin Chan")
  assert.deepEqual(updates.tags, ["AI", "Agent"])
  assert.equal(updates.totalPages, 19)
  assert.equal(updates.synopsis, "Building AI agents is hard.")
  assert.equal(updates.content?.[0]?.content, "Building AI agents is hard.")
})

test("repairPlaceholderPdfBook 会下载原文件并持久化修复后的正文", async () => {
  const book = createPdfBook()
  const parsed = createParsedMetadata()
  const calls: string[] = []

  const repaired = await repairPlaceholderPdfBook(book, {
    async downloadBuffer(storedPath) {
      calls.push(`download:${storedPath}`)
      return Buffer.from("pdf")
    },
    async parsePdf(buffer, fileName) {
      calls.push(`parse:${buffer.toString()}:${fileName}`)
      return parsed
    },
    async saveBook(userId, bookId, updates) {
      calls.push(`save:${userId}:${bookId}:${updates.totalPages}`)
      return {
        ...book,
        ...updates
      }
    }
  })

  assert.equal(repaired?.title, "Coding Agent is All You Need")
  assert.equal(repaired?.content[0]?.content, "Building AI agents is hard.")
  assert.deepEqual(calls, [
    "download:minio://lumina-books/books/user-1/book-1/sample.pdf",
    "parse:pdf:sample.pdf",
    "save:user-1:book-1:19"
  ])
})

test("repairPlaceholderPdfBook 遇到非占位 PDF 时直接返回原书籍", async () => {
  const book = createPdfBook({
    content: [
      {
        id: "section-1",
        title: "Abstract",
        pageIndex: 1,
        content: "Already parsed."
      }
    ],
    synopsis: "Already parsed."
  })

  const repaired = await repairPlaceholderPdfBook(book, {
    async downloadBuffer() {
      throw new Error("should not download")
    },
    async parsePdf() {
      throw new Error("should not parse")
    },
    async saveBook() {
      throw new Error("should not save")
    }
  })

  assert.equal(repaired, book)
})
