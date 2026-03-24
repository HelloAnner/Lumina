import path from "node:path"
import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { decryptValue } from "@/src/server/lib/crypto"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import {
  deriveBookMetadata,
  type HardParsedBookMetadata,
  extractEpubMetadata
} from "@/src/server/services/books/metadata"
import { repairStoredBook } from "@/src/server/services/books/book-repair"
import { extractPdfMetadata } from "@/src/server/services/books/pdf-metadata"
import {
  createBookInStore,
  deleteBookFromStore,
  getBookFromStore,
  getBookObjectLocationFromStore,
  listBooksFromStore,
  updateBookInStore
} from "@/src/server/services/books/store"
import {
  getReaderProgress,
  saveReaderProgress
} from "@/src/server/services/books/progress"
import {
  buildBookFileProxyPath,
  buildBookObjectName,
  getBookObjectBuffer,
  buildObjectResponse,
  formatMinioPath,
  getStoredObjectContentType,
  getStoredObjectUrl,
  parseMinioPath,
  removeBookObject,
  uploadBookObject,
  uploadCoverImage
} from "@/src/server/services/books/minio"
import { attachPdfPageImageBlocks } from "@/src/server/services/books/pdf-page-images"

const app = new Hono<AppEnv>()

function buildFallbackPdfMetadata(fileName: string): HardParsedBookMetadata {
  return {
    title: fileName.replace(/\.pdf$/i, ""),
    author: "未知作者",
    format: "PDF" as const,
    tags: ["PDF"],
    sections: [
      {
        id: randomUUID(),
        title: "导入文档",
        pageIndex: 1,
        content: "当前 PDF 已存储成功，但暂未提取到可用正文。"
      }
    ],
    totalPages: 1,
    synopsis: "当前 PDF 已存储成功，但暂未提取到可用正文。",
    toc: [{ id: randomUUID(), title: "导入文档", pageIndex: 1 }]
  }
}

async function parsePdfHardMetadata(buffer: Buffer, fileName: string) {
  try {
    return await extractPdfMetadata(buffer, fileName)
  } catch (error) {
    console.warn(`Failed to parse PDF metadata, fallback to placeholder: ${fileName}`, error)
    return buildFallbackPdfMetadata(fileName)
  }
}

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
      : await parsePdfHardMetadata(buffer, file.name)

  let metadata = await deriveBookMetadata({
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

  if (format === "PDF") {
    try {
      metadata = {
        ...metadata,
        sections: await attachPdfPageImageBlocks({
          buffer,
          userId: c.get("userId"),
          bookId,
          sections: metadata.sections
        })
      }
    } catch (error) {
      console.warn(`Failed to attach PDF page images during upload: ${file.name}`, error)
    }
  }

  const uploaded = await uploadBookObject({
    userId: c.get("userId"),
    bookId,
    fileName: file.name,
    buffer,
    contentType: file.type || "application/octet-stream"
  })

  const filePath = formatMinioPath(uploaded.bucket, uploaded.objectName)

  let coverPath = ""
  let coverImageBase64 = hardParsed.coverImageBase64

  if (!coverImageBase64 && hardParsed.isbn) {
    const { fetchCoverFromOpenLibrary } = await import("@/src/server/services/books/metadata")
    coverImageBase64 = await fetchCoverFromOpenLibrary(hardParsed.isbn)
  }

  if (coverImageBase64) {
    try {
      const coverUploaded = await uploadCoverImage({
        userId: c.get("userId"),
        bookId,
        imageBase64: coverImageBase64
      })
      coverPath = formatMinioPath(coverUploaded.bucket, coverUploaded.objectName)
    } catch {
      console.error("Failed to upload cover image")
    }
  }

  const book = await createBookInStore({
    id: bookId,
    userId: c.get("userId"),
    title: metadata.title,
    author: metadata.author,
    format,
    filePath,
    coverPath,
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
    toastMessage: metadata.toastMessage,
    previewSections: metadata.sections.slice(0, 3)
  })
})

app.get("/:id", async (c) => {
  const stored = await getBookFromStore(c.get("userId"), c.req.param("id"))
  const book = stored ? await repairStoredBook(stored) : null
  if (!book) {
    return c.json({ error: "书籍不存在" }, 404)
  }
  return c.json({ item: book })
})

app.get("/:id/access-url", async (c) => {
  const stored = await getBookFromStore(c.get("userId"), c.req.param("id"))
  const book = stored ? await repairStoredBook(stored) : null
  if (!book) {
    return c.json({ error: "书籍不存在" }, 404)
  }
  const fileUrl = buildBookFileProxyPath(book.id)
  const coverUrl = await getStoredObjectUrl(book.coverPath)
  return c.json({
    fileUrl,
    coverUrl,
    format: book.format,
    totalPages: book.totalPages,
    toc: book.toc,
    content: book.content
  })
})

app.on(["GET", "HEAD"], "/:id/file", async (c) => {
  const stored = await getBookFromStore(c.get("userId"), c.req.param("id"))
  const book = stored ? await repairStoredBook(stored) : null
  if (!book) {
    return c.json({ error: "书籍不存在" }, 404)
  }

  const objectLocation = await getBookObjectLocationFromStore(
    c.get("userId"),
    c.req.param("id")
  )
  const buffer = objectLocation
    ? await getBookObjectBuffer(objectLocation.bucket, objectLocation.objectName)
    : null
  if (!buffer) {
    return c.json({ error: "文件不存在" }, 404)
  }

  const payload = buildObjectResponse(buffer, {
    contentType: getStoredObjectContentType(objectLocation?.storedPath ?? book.filePath),
    rangeHeader: c.req.header("range")
  })
  const fileName = path.basename(objectLocation?.objectName ?? book.filePath)
  const headers = new Headers(payload.headers)
  headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`)
  headers.set("Cache-Control", "private, max-age=900")

  if (c.req.method === "HEAD") {
    return new Response(null, {
      headers,
      status: payload.status
    })
  }

  return new Response(new Uint8Array(payload.body), {
    headers,
    status: payload.status
  })
})

app.get("/:id/page-images/:pageNumber", async (c) => {
  const stored = await getBookFromStore(c.get("userId"), c.req.param("id"))
  const book = stored ? await repairStoredBook(stored) : null
  if (!book) {
    return c.json({ error: "书籍不存在" }, 404)
  }

  const objectLocation = await getBookObjectLocationFromStore(
    c.get("userId"),
    c.req.param("id")
  )
  const buffer = await getBookObjectBuffer(
    objectLocation?.bucket ?? parseMinioPath(book.filePath)?.bucket ?? "lumina-books",
    buildBookObjectName(
      c.get("userId"),
      book.id,
      `page-images/${c.req.param("pageNumber")}.png`
    )
  )
  if (!buffer) {
    return c.json({ error: "页图不存在" }, 404)
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, max-age=900",
      "Content-Type": "image/png"
    },
    status: 200
  })
})

app.post("/:id/pdf-page-images/rebuild", async (c) => {
  const stored = await getBookFromStore(c.get("userId"), c.req.param("id"))
  const book = stored ? await repairStoredBook(stored) : null
  if (!book) {
    return c.json({ error: "书籍不存在" }, 404)
  }
  if (book.format !== "PDF") {
    return c.json({ error: "当前书籍不是 PDF" }, 400)
  }

  const objectLocation = await getBookObjectLocationFromStore(
    c.get("userId"),
    c.req.param("id")
  )
  const buffer = objectLocation
    ? await getBookObjectBuffer(objectLocation.bucket, objectLocation.objectName)
    : null
  if (!buffer) {
    return c.json({ error: "原始 PDF 不存在" }, 404)
  }

  const nextContent = await attachPdfPageImageBlocks({
    buffer,
    userId: c.get("userId"),
    bookId: book.id,
    sections: book.content
  })
  const updated = await updateBookInStore(c.get("userId"), book.id, {
    content: nextContent
  })
  return c.json({
    item: updated ?? {
      ...book,
      content: nextContent
    }
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
  const fileObject = parseMinioPath(book?.filePath)
  if (fileObject) {
    await removeBookObject(fileObject.bucket, fileObject.objectName)
  }
  const coverObject = parseMinioPath(book?.coverPath)
  if (coverObject) {
    await removeBookObject(coverObject.bucket, coverObject.objectName)
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
