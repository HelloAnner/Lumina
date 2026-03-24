/**
 * PDF 元数据解析
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import crypto from "node:crypto"
import type { HardParsedBookMetadata } from "@/src/server/services/books/metadata"

interface PdfMetadataInfoLike {
  Title?: string
  Author?: string
  Keywords?: string
}

interface PdfTextItemLike {
  str?: string
  hasEOL?: boolean
  transform?: number[]
}

interface PdfTextContentLike {
  items?: PdfTextItemLike[]
}

interface PdfPageLike {
  getTextContent(): Promise<PdfTextContentLike>
}

interface PdfOutlineNodeLike {
  title?: string
  dest?: string | unknown[] | null
  items?: PdfOutlineNodeLike[]
}

interface PdfMetadataLike {
  info?: PdfMetadataInfoLike
}

type PdfRefLike = {
  num: number
  gen: number
}

export interface PdfDocumentLike {
  numPages: number
  getMetadata(): Promise<PdfMetadataLike>
  getOutline(): Promise<PdfOutlineNodeLike[] | null>
  getDestination(name: string): Promise<unknown[] | null>
  getPageIndex(ref: PdfRefLike): Promise<number>
  getPage(pageNumber: number): Promise<PdfPageLike>
}

function normalizeTextLine(items: PdfTextItemLike[]) {
  return items
    .map((item) => item.str?.trim() ?? "")
    .filter(Boolean)
    .join("")
    .trim()
}

function buildPageText(content: PdfTextContentLike) {
  const items = Array.isArray(content.items) ? content.items : []
  const lines: string[] = []
  let lineBuffer: PdfTextItemLike[] = []

  items.forEach((item) => {
    if (!item.str?.trim()) {
      if (lineBuffer.length > 0 && item.hasEOL) {
        const line = normalizeTextLine(lineBuffer)
        if (line) {
          lines.push(line)
        }
        lineBuffer = []
      }
      return
    }

    lineBuffer.push(item)
    if (item.hasEOL) {
      const line = normalizeTextLine(lineBuffer)
      if (line) {
        lines.push(line)
      }
      lineBuffer = []
    }
  })

  if (lineBuffer.length > 0) {
    const line = normalizeTextLine(lineBuffer)
    if (line) {
      lines.push(line)
    }
  }

  return lines.join("\n\n").trim()
}

function fallbackTitle(fileName: string) {
  return fileName.replace(/\.pdf$/i, "") || "未命名 PDF"
}

function fallbackSynopsis(title: string, pageTexts: string[]) {
  const sample = pageTexts.find((item) => item.trim())?.slice(0, 140).trim()
  if (sample) {
    return sample
  }
  return `${title} 已完成 PDF 基础解析，可继续在阅读器中查看。`
}

function buildMissingPageText(pageNumber: number) {
  return `第 ${pageNumber} 页暂未提取到可用文本。`
}

async function resolveDestPageIndex(
  pdf: PdfDocumentLike,
  dest: PdfOutlineNodeLike["dest"]
) {
  if (!dest) {
    return undefined
  }

  let resolved: unknown[] | null = Array.isArray(dest) ? dest : null
  if (typeof dest === "string") {
    resolved = await pdf.getDestination(dest)
  }
  if (!Array.isArray(resolved) || resolved.length === 0) {
    return undefined
  }

  const ref = resolved[0]
  if (!ref || typeof ref !== "object") {
    return undefined
  }

  const target = ref as Partial<PdfRefLike>
  if (typeof target.num !== "number" || typeof target.gen !== "number") {
    return undefined
  }

  const pageIndex = await pdf.getPageIndex({
    num: target.num,
    gen: target.gen
  })

  return pageIndex + 1
}

async function safeResolveDestPageIndex(
  pdf: PdfDocumentLike,
  dest: PdfOutlineNodeLike["dest"]
) {
  try {
    return await resolveDestPageIndex(pdf, dest)
  } catch (error) {
    console.warn("Skipped broken PDF outline destination", error)
    return undefined
  }
}

async function appendOutlineNodes(
  pdf: PdfDocumentLike,
  nodes: PdfOutlineNodeLike[],
  level: number,
  bucket: HardParsedBookMetadata["toc"]
) {
  for (const node of nodes) {
    const title = node.title?.trim()
    const pageIndex = await safeResolveDestPageIndex(pdf, node.dest)
    if (title && typeof pageIndex === "number") {
      bucket.push({
        id: crypto.randomUUID(),
        title,
        pageIndex,
        level
      })
    }
    const children = Array.isArray(node.items) ? node.items : []
    if (children.length > 0) {
      await appendOutlineNodes(pdf, children, level + 1, bucket)
    }
  }
}

async function extractPageContent(
  pdf: PdfDocumentLike,
  pageNumber: number
) {
  try {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    return buildPageText(textContent) || buildMissingPageText(pageNumber)
  } catch (error) {
    console.warn(`Skipped broken PDF page text extraction: page ${pageNumber}`, error)
    return buildMissingPageText(pageNumber)
  }
}

async function extractPdfInfo(pdf: PdfDocumentLike) {
  try {
    const metadata = await pdf.getMetadata()
    return metadata.info ?? {}
  } catch (error) {
    console.warn("Failed to read PDF metadata info", error)
    return {}
  }
}

async function extractPdfOutline(pdf: PdfDocumentLike) {
  try {
    return (await pdf.getOutline()) ?? []
  } catch (error) {
    console.warn("Failed to read PDF outline", error)
    return []
  }
}

function buildPageTitle(
  pageNumber: number,
  toc: HardParsedBookMetadata["toc"]
) {
  const exact = toc.find((item) => item.pageIndex === pageNumber)
  if (exact?.title) {
    return exact.title
  }
  return `第 ${pageNumber} 页`
}

export async function extractPdfMetadataFromDocument(
  pdf: PdfDocumentLike,
  fileName: string
): Promise<HardParsedBookMetadata> {
  const info = await extractPdfInfo(pdf)
  const title = info.Title?.trim() || fallbackTitle(fileName)
  const author = info.Author?.trim() || "未知作者"
  const outline = await extractPdfOutline(pdf)
  const toc: HardParsedBookMetadata["toc"] = []
  await appendOutlineNodes(pdf, outline, 0, toc)

  const pageTexts: string[] = []
  const sections: HardParsedBookMetadata["sections"] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const content = await extractPageContent(pdf, pageNumber)
    pageTexts.push(content)
    sections.push({
      id: crypto.randomUUID(),
      title: buildPageTitle(pageNumber, toc),
      pageIndex: pageNumber,
      content
    })
  }

  const keywords = info.Keywords?.split(/[;,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5) ?? []

  return {
    title,
    author,
    format: "PDF",
    tags: keywords.length > 0 ? keywords : ["PDF"],
    sections,
    totalPages: pdf.numPages,
    synopsis: fallbackSynopsis(title, pageTexts),
    toc
  }
}

export async function extractPdfMetadata(
  buffer: Buffer,
  fileName: string
): Promise<HardParsedBookMetadata> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0
  })
  const pdf = await loadingTask.promise
  try {
    return await extractPdfMetadataFromDocument(pdf as PdfDocumentLike, fileName)
  } finally {
    await pdf.destroy()
  }
}
