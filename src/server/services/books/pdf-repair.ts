/**
 * PDF 占位正文修复
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import path from "node:path"
import { updateBookInStore } from "@/src/server/services/books/store"
import { extractPdfMetadata } from "@/src/server/services/books/pdf-metadata"
import { getStoredObjectBuffer } from "@/src/server/services/books/minio"
import type { HardParsedBookMetadata } from "@/src/server/services/books/metadata"
import type { Book } from "@/src/server/store/types"
import { attachPdfPageImageBlocks } from "@/src/server/services/books/pdf-page-images"

export const PDF_UPLOAD_PLACEHOLDER_TEXT = "当前 PDF 已存储成功，但暂未提取到可用正文。"

type RepairDependencies = {
  downloadBuffer: (storedPath: string) => Promise<Buffer | null>
  parsePdf: (buffer: Buffer, fileName: string) => Promise<HardParsedBookMetadata>
  saveBook: (userId: string, bookId: string, updates: Partial<Book>) => Promise<Book | null>
}

function isUnknownAuthor(author?: string) {
  return !author || author.trim() === "" || author === "未知作者"
}

function isDefaultPdfTag(tags: string[]) {
  return tags.length === 0 || (tags.length === 1 && tags[0] === "PDF")
}

function getPdfFileName(filePath: string) {
  const rawName = path.basename(filePath.replace(/^minio:\/\/[^/]+\//, ""))
  return decodeURIComponent(rawName) || "未命名 PDF.pdf"
}

function shouldReplaceTitle(book: Book, parsed: HardParsedBookMetadata, fileName: string) {
  if (!parsed.title.trim()) {
    return false
  }
  const fallbackTitle = fileName.replace(/\.pdf$/i, "")
  return !book.title.trim() || book.title === fallbackTitle
}

export function needsPdfTextRepair(book: Pick<Book, "format" | "content">) {
  if (book.format !== "PDF") {
    return false
  }
  if (!Array.isArray(book.content) || book.content.length === 0) {
    return true
  }
  return book.content.every((section) => {
    const content = section.content.trim()
    return !content || content === PDF_UPLOAD_PLACEHOLDER_TEXT
  })
}

export function buildRepairedPdfBookUpdates(
  book: Book,
  parsed: HardParsedBookMetadata,
  fileName: string
): Partial<Book> {
  return {
    title: shouldReplaceTitle(book, parsed, fileName) ? parsed.title : book.title,
    author: isUnknownAuthor(book.author) ? parsed.author : book.author,
    tags: isDefaultPdfTag(book.tags) ? parsed.tags : book.tags,
    totalPages: parsed.totalPages || book.totalPages,
    synopsis:
      !book.synopsis.trim() || book.synopsis === PDF_UPLOAD_PLACEHOLDER_TEXT
        ? parsed.synopsis
        : book.synopsis,
    toc: parsed.toc.length > 0 ? parsed.toc : book.toc,
    content: parsed.sections.length > 0 ? parsed.sections : book.content
  }
}

export async function repairPlaceholderPdfBook(
  book: Book,
  dependencies?: Partial<RepairDependencies>
) {
  if (!needsPdfTextRepair(book) || !book.filePath) {
    return book
  }

  const downloadBuffer = dependencies?.downloadBuffer ?? getStoredObjectBuffer
  const parsePdf = dependencies?.parsePdf ?? extractPdfMetadata
  const saveBook = dependencies?.saveBook ?? updateBookInStore
  try {
    const buffer = await downloadBuffer(book.filePath)
    if (!buffer) {
      return book
    }

    const fileName = getPdfFileName(book.filePath)
    const parsed = await parsePdf(buffer, fileName)
    if (parsed.sections.length === 0) {
      return book
    }

    let nextParsed = parsed
    try {
      nextParsed = {
        ...parsed,
        sections: await attachPdfPageImageBlocks({
          buffer,
          userId: book.userId,
          bookId: book.id,
          sections: parsed.sections
        })
      }
    } catch {
      nextParsed = parsed
    }

    const updates = buildRepairedPdfBookUpdates(book, nextParsed, fileName)
    return (await saveBook(book.userId, book.id, updates)) ?? {
      ...book,
      ...updates
    }
  } catch {
    return book
  }
}
