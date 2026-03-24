/**
 * 阅读翻译服务测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { encryptValue } from "@/src/server/lib/crypto"
import type { Book, ModelConfig } from "@/src/server/store/types"

test("buildTranslatedSectionSnapshot 会保留图片块顺序并替换段落文本", async () => {
  const { buildTranslatedSectionSnapshot } = await import("./service")

  const snapshot = buildTranslatedSectionSnapshot(
    {
      id: "section-1",
      title: "第一章",
      pageIndex: 1,
      content: "原文第一段。\n\n原文第二段。",
      blocks: [
        {
          type: "paragraph",
          text: "原文第一段。"
        },
        {
          type: "image",
          src: "cover.png",
          alt: "配图"
        },
        {
          type: "paragraph",
          text: "原文第二段。"
        }
      ]
    },
    ["译文第一段。", "译文第二段。"]
  )

  assert.equal(snapshot.content, "译文第一段。\n\n译文第二段。")
  assert.deepEqual(snapshot.blocks, [
    {
      type: "paragraph",
      text: "译文第一段。"
    },
    {
      type: "image",
      src: "cover.png",
      alt: "配图"
    },
    {
      type: "paragraph",
      text: "译文第二段。"
    }
  ])
})

test("repository.upsertBookTranslation 会复用同一章节缓存而不是重复新增", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-translation-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("../../repositories")

  try {
    const demo = repository.getUserByEmail(
      process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
    )

    assert.ok(demo, "应存在默认演示账号")

    const books = repository.listBooks(demo!.id)
    assert.ok(books.length > 0, "应存在默认演示书籍")

    const firstBook = books[0]
    const firstSection = firstBook.content[0]
    const targetLanguage = "unit-test-cache"

    const created = repository.upsertBookTranslation({
      userId: demo!.id,
      bookId: firstBook.id,
      sectionId: firstSection.id,
      sectionIndex: 0,
      pageIndex: firstSection.pageIndex,
      sourceHash: "hash-1",
      targetLanguage,
      content: "第一版译文",
      blocks: [
        {
          type: "paragraph",
          text: "第一版译文"
        }
      ],
      modelId: "model-1"
    })

    const updated = repository.upsertBookTranslation({
      userId: demo!.id,
      bookId: firstBook.id,
      sectionId: firstSection.id,
      sectionIndex: 0,
      pageIndex: firstSection.pageIndex,
      sourceHash: "hash-1",
      targetLanguage,
      content: "第二版译文",
      blocks: [
        {
          type: "paragraph",
          text: "第二版译文"
        }
      ],
      modelId: "model-2"
    })

    const items = repository
      .listBookTranslations(demo!.id, firstBook.id)
      .filter((item) =>
        item.sectionId === firstSection.id &&
        item.sourceHash === "hash-1" &&
        item.targetLanguage === targetLanguage
      )

    assert.equal(items.length, 1)
    assert.equal(created.id, updated.id)
    assert.equal(items[0].content, "第二版译文")
    assert.equal(items[0].modelId, "model-2")
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("extractModelMessageContent 遇到 HTML 响应时给出友好错误", async () => {
  const { extractModelMessageContent } = await import("./service")

  await assert.rejects(
    () =>
      extractModelMessageContent({
        text: async () => "<!doctype html><html><body>login</body></html>"
      } as Response),
    /翻译服务返回了页面内容/
  )
})

test("prefetchBookTranslations 会复用同章节的进行中翻译任务", async (context) => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-translation-dedupe-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("../../repositories")
  const { prefetchBookTranslations } = await import("./service")

  const demo = repository.getUserByEmail(
    process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
  )

  assert.ok(demo, "应存在默认演示账号")

  const book: Book = {
    id: "book-dedupe",
    userId: demo!.id,
    title: "并发测试书",
    format: "EPUB",
    filePath: "book.epub",
    readProgress: 0,
    tags: [],
    status: "READY",
    synopsis: "测试",
    toc: [{ id: "toc-1", title: "Chapter One", pageIndex: 1 }],
    content: [
      {
        id: "section-1",
        title: "Chapter One",
        pageIndex: 1,
        content: "Paragraph One.",
        blocks: [{ type: "paragraph", text: "Paragraph One." }]
      }
    ],
    createdAt: new Date().toISOString()
  }

  const model: ModelConfig = {
    id: "model-translation",
    userId: demo!.id,
    category: "language",
    name: "翻译模型",
    baseUrl: "https://example.com/v1",
    apiKey: encryptValue("demo-key"),
    modelName: "demo-model"
  }

  let fetchCount = 0
  context.mock.method(globalThis, "fetch", async (_url, init) => {
    fetchCount += 1
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    const payload = JSON.parse(body.messages[1]!.content) as {
      items: Array<{ index: number; text: string }>
    }
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: payload.items.map((item) => ({
                    index: item.index,
                    translation: item.index === 0 ? "译文内容" : `目录译文-${item.index}`
                  }))
                })
              }
            }
          ]
        })
    } as Response
  })

  try {
    const [left, right] = await Promise.all([
      prefetchBookTranslations({
        userId: demo!.id,
        book,
        sectionIndexes: [0],
        targetLanguage: "unit-test-dedupe",
        model
      }),
      prefetchBookTranslations({
        userId: demo!.id,
        book,
        sectionIndexes: [0],
        targetLanguage: "unit-test-dedupe",
        model
      })
    ])

    assert.equal(fetchCount, 2)
    assert.equal(left.items.length, 1)
    assert.equal(right.items.length, 1)
    assert.equal(left.items[0]?.content, "译文内容")
    assert.equal(right.items[0]?.content, "译文内容")
    assert.equal(left.toc?.items.length, book.toc.length)
    assert.equal(right.toc?.items.length, book.toc.length)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test("prefetchBookTranslations 会翻译目录并持久化缓存", async (context) => {
  const dataDir = mkdtempSync(join(tmpdir(), "lumina-translation-toc-test-"))
  process.env.DATA_DIR = dataDir

  const { repository } = await import("../../repositories")
  const { prefetchBookTranslations } = await import("./service")

  const demo = repository.getUserByEmail(
    process.env.DEFAULT_DEMO_EMAIL ?? "demo@lumina.local"
  )

  assert.ok(demo, "应存在默认演示账号")

  const book: Book = {
    id: "book-toc-translation",
    userId: demo!.id,
    title: "目录翻译测试书",
    format: "EPUB",
    filePath: "book.epub",
    readProgress: 0,
    tags: [],
    status: "READY",
    synopsis: "测试",
    toc: [{ id: "toc-1", title: "Chapter One", pageIndex: 1 }],
    content: [
      {
        id: "section-1",
        title: "Chapter One",
        pageIndex: 1,
        content: "Paragraph One.",
        blocks: [{ type: "paragraph", text: "Paragraph One." }]
      }
    ],
    createdAt: new Date().toISOString()
  }

  const model: ModelConfig = {
    id: "model-translation",
    userId: demo!.id,
    category: "language",
    name: "翻译模型",
    baseUrl: "https://example.com/v1",
    apiKey: encryptValue("demo-key"),
    modelName: "demo-model"
  }

  context.mock.method(globalThis, "fetch", async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    const payload = JSON.parse(body.messages[1]!.content) as {
      items: Array<{ index: number; text: string }>
    }
    const items = payload.items.map((item) => ({
      index: item.index,
      translation: `译-${item.text}`
    }))

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ items }) } }]
        })
    } as Response
  })

  try {
    const result = await prefetchBookTranslations({
      userId: demo!.id,
      book,
      sectionIndexes: [0],
      targetLanguage: "unit-test-toc",
      model
    })

    assert.equal(result.items.length, 1)
    assert.ok(result.toc, "应返回目录译文")
    assert.equal(result.toc?.items.length, book.toc.length)
    assert.equal(result.toc?.items[0]?.title, `译-${book.toc[0]?.title}`)

    const cachedToc = repository.listBookTocTranslations(demo!.id, book.id)
    assert.equal(cachedToc.length, 1)
    assert.equal(cachedToc[0]?.targetLanguage, "unit-test-toc")
    assert.equal(cachedToc[0]?.items[0]?.title, `译-${book.toc[0]?.title}`)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})
