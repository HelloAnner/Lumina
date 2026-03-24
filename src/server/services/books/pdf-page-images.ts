/**
 * PDF 页图快照服务
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import { buildFallbackParagraphBlocksFromContent } from "@/src/lib/book-content"
import { uploadBookObject } from "@/src/server/services/books/minio"
import type { ReaderSection } from "@/src/server/store/types"

const PAGE_IMAGE_PREFIX = "page-images"
const PAGE_IMAGE_SCALE = 1.25

export function buildPdfPageImageProxyPath(bookId: string, pageNumber: number) {
  return `/api/books/${bookId}/page-images/${pageNumber}`
}

export function mergePdfPageImageBlock(
  section: ReaderSection,
  bookId: string
): ReaderSection {
  const nextSrc = buildPdfPageImageProxyPath(bookId, section.pageIndex)
  const existingBlocks = section.blocks?.length
    ? [...section.blocks]
    : buildFallbackParagraphBlocksFromContent(section.content)
  const duplicated = existingBlocks.some(
    (block) => block.type === "image" && block.src === nextSrc
  )
  if (duplicated) {
    return {
      ...section,
      blocks: existingBlocks
    }
  }

  return {
    ...section,
    blocks: [
      ...existingBlocks,
      {
        type: "image",
        src: nextSrc,
        alt: `第 ${section.pageIndex} 页版面图`
      }
    ]
  }
}

function buildPdfPageImageFileName(pageNumber: number) {
  return `${PAGE_IMAGE_PREFIX}/${pageNumber}.png`
}

function pageHasImageOperator(operatorList: { fnArray?: number[] }, ops: Record<string, number>) {
  const imageOps = new Set(
    [
      ops.paintImageXObject,
      ops.paintInlineImageXObject,
      ops.paintImageMaskXObject,
      ops.paintJpegXObject,
      ops.paintImageXObjectRepeat,
      ops.paintImageMaskXObjectRepeat
    ].filter((value): value is number => typeof value === "number")
  )

  return (operatorList.fnArray ?? []).some((fn) => imageOps.has(fn))
}

async function renderPdfPageSnapshot(
  pdf: any,
  pageNumber: number
) {
  const page = await pdf.getPage(pageNumber)
  try {
    const viewport = page.getViewport({ scale: PAGE_IMAGE_SCALE })
    const canvasFactory = pdf.canvasFactory
    if (!canvasFactory?.create) {
      return null
    }
    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height)
    await page.render({
      canvasContext: canvasAndContext.context,
      viewport,
      background: "rgb(255,255,255)"
    }).promise
    return Buffer.from(canvasAndContext.canvas.toBuffer("image/png"))
  } finally {
    page.cleanup()
  }
}

export async function attachPdfPageImageBlocks(params: {
  buffer: Buffer
  userId: string
  bookId: string
  sections: ReaderSection[]
}) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(params.buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0
  })
  const pdf = await loadingTask.promise

  try {
    const sectionMap = new Map(params.sections.map((section) => [section.pageIndex, section]))

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const operatorList = await page.getOperatorList()
      page.cleanup()
      if (!pageHasImageOperator(operatorList, pdfjs.OPS)) {
        continue
      }

      const snapshot = await renderPdfPageSnapshot(pdf, pageNumber)
      if (!snapshot) {
        continue
      }

      await uploadBookObject({
        userId: params.userId,
        bookId: params.bookId,
        fileName: buildPdfPageImageFileName(pageNumber),
        buffer: snapshot,
        contentType: "image/png"
      })

      const section = sectionMap.get(pageNumber)
      if (!section) {
        continue
      }
      sectionMap.set(pageNumber, mergePdfPageImageBlock(section, params.bookId))
    }

    return params.sections.map((section) => sectionMap.get(section.pageIndex) ?? section)
  } finally {
    await pdf.destroy()
  }
}
