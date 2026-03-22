import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { decryptValue } from "@/src/server/lib/crypto"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import {
  deriveBookMetadata,
  extractEpubMetadata
} from "@/src/server/services/books/metadata"
import {
  createBookInStore,
  deleteBookFromStore,
  getBookFromStore,
  listBooksFromStore,
  updateBookInStore
} from "@/src/server/services/books/store"
import {
  getReaderProgress,
  saveReaderProgress
} from "@/src/server/services/books/progress"
import {
  getBookObjectUrl,
  removeBookObject,
  uploadBookObject
} from "@/src/server/services/books/minio"

const app = new Hono<AppEnv>()

app.get("/", async (c) => {
  const search = c.req.query("search")
  const tag = c.req.query("tag")
  return c.json({
    items: await listBooksFromStore(c.get("userId"), search, tag)
  })
})

app.post("/upload", async (c) => {
  const formData = await c.req.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return c.json({ error: "缺少文件" }, 400)
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const format = file.name.toLowerCase().endsWith(".epub") ? "EPUB" : "PDF"
  const bookId = randomUUID()

  const explainConfig = repository.getModelByFeature(c.get("userId"), "instant_explain")

  const hardParsed =
    format === "EPUB"
      ? await extractEpubMetadata(buffer, file.name)
      : {
          title: file.name.replace(/\.(pdf|epub)$/i, ""),
          author: "未知作者",
          format: "PDF" as const,
          tags: ["PDF"],
          sections: [
            {
              id: randomUUID(),
              title: "导入文档",
              pageIndex: 1,
              content: "当前 PDF 上传已完成存储，后续可继续替换为真实 PDF 文本解析结果。"
            }
          ],
          totalPages: 1,
          synopsis: "当前 PDF 上传已完成存储，后续可继续替换为真实 PDF 文本解析结果。",
          toc: [{ id: randomUUID(), title: "导入文档", pageIndex: 1 }]
        }

  const metadata = await deriveBookMetadata({
    fileName: file.name,
    userId: c.get("userId"),
    hardParsed,
    llmConfig: explainConfig && explainConfig.baseUrl && explainConfig.apiKey
      ? {
          baseUrl: explainConfig.baseUrl,
          apiKey: decryptValue(explainConfig.apiKey),
          modelName: explainConfig.modelName
        }
      : null
  })

  const uploaded = await uploadBookObject({
    userId: c.get("userId"),
    bookId,
    fileName: file.name,
    buffer,
    contentType: file.type || "application/octet-stream"
  })

  const filePath = `minio://${uploaded.bucket}/${uploaded.objectName}`
  const book = await createBookInStore({
    id: bookId,
    userId: c.get("userId"),
    title: metadata.title,
    author: metadata.author,
    format,
    filePath,
    coverPath: "",
    totalPages: metadata.totalPages,
    readProgress: 0,
    lastReadAt: new Date().toISOString(),
    tags: metadata.tags,
    status: "READY",
    synopsis: metadata.synopsis,
    toc: metadata.toc,
    content: metadata.sections,
    objectBucket: uploaded.bucket,
    objectKey: uploaded.objectName
  })
  return c.json({
    item: book,
    parseMode: metadata.parseMode,
    toastMessage: metadata.toastMessage
  })
})

app.get("/:id", async (c) => {
  const book = await getBookFromStore(c.get("userId"), c.req.param("id"))
  if (!book) {
    return c.json({ error: "书籍不存在" }, 404)
  }
  return c.json({ item: book })
})

app.get("/:id/access-url", async (c) => {
  const book = await getBookFromStore(c.get("userId"), c.req.param("id"))
  if (!book) {
    return c.json({ error: "书籍不存在" }, 404)
  }
  const match = book.filePath.match(/^minio:\/\/([^/]+)\/(.+)$/)
  const fileUrl = match ? await getBookObjectUrl(match[1], match[2]) : ""
  return c.json({
    fileUrl,
    format: book.format,
    totalPages: book.totalPages,
    toc: book.toc,
    content: book.content
  })
})

app.get("/:id/toc", async (c) => {
  const book = await getBookFromStore(c.get("userId"), c.req.param("id"))
  return c.json({ items: book?.toc ?? [] })
})

app.put("/:id", async (c) => {
  const payload = z
    .object({
      title: z.string().optional(),
      author: z.string().optional(),
      tags: z.array(z.string()).optional()
    })
    .parse(await c.req.json())
  const book = await updateBookInStore(c.get("userId"), c.req.param("id"), payload)
  return c.json({ item: book })
})

app.delete("/:id", async (c) => {
  const book = await getBookFromStore(c.get("userId"), c.req.param("id"))
  if (book?.filePath?.startsWith("minio://")) {
    const match = book.filePath.match(/^minio:\/\/([^/]+)\/(.+)$/)
    if (match) {
      await removeBookObject(match[1], match[2])
    }
  }
  await deleteBookFromStore(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

app.get("/:id/progress", async (c) => {
  const book = await getBookFromStore(c.get("userId"), c.req.param("id"))
  const progress = await getReaderProgress(c.get("userId"), c.req.param("id"))
  return c.json({
    progress: book?.readProgress ?? progress.progress ?? 0,
    currentSectionIndex: progress.currentSectionIndex,
    currentParagraphIndex: progress.currentParagraphIndex
  })
})

app.put("/:id/progress", async (c) => {
  const payload = z
    .object({
      progress: z.number().min(0).max(1),
      currentSectionIndex: z.number().min(0).optional(),
      currentParagraphIndex: z.number().min(0).optional()
    })
    .parse(await c.req.json())
  const book = await updateBookInStore(c.get("userId"), c.req.param("id"), {
    readProgress: payload.progress,
    lastReadAt: new Date().toISOString()
  })
  const readerProgress = await saveReaderProgress(c.get("userId"), c.req.param("id"), {
    progress: payload.progress,
    currentSectionIndex: payload.currentSectionIndex,
    currentParagraphIndex: payload.currentParagraphIndex
  })
  return c.json({ item: book, readerProgress })
})

app.get("/:id/highlights", (c) => {
  return c.json({
    items: repository.listHighlightsByBook(c.get("userId"), c.req.param("id"))
  })
})

export default app
