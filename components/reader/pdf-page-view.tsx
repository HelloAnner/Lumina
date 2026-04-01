/**
 * PDF 单页渲染
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { normalizePdfDragRect, type PdfHighlightRect } from "@/components/reader/pdf-highlight-utils"
import type { Highlight } from "@/src/server/store/types"

/** 模块级缓存，避免每页重复 dynamic import */
let pdfjsModulePromise: Promise<typeof import("pdfjs-dist/webpack.mjs")> | null = null
function getPdfjsModule() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import("pdfjs-dist/webpack.mjs")
  }
  return pdfjsModulePromise
}

function buildHighlightRects(item: Highlight) {
  return Array.isArray(item.pdfRects) ? item.pdfRects : []
}

function buildRectFromPoints(
  start: { x: number; y: number },
  current: { x: number; y: number }
) {
  return {
    left: Math.min(start.x, current.x),
    top: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y)
  }
}

function intersects(first: DOMRect, second: DOMRect) {
  const left = Math.max(first.left, second.left)
  const top = Math.max(first.top, second.top)
  const right = Math.min(first.right, second.right)
  const bottom = Math.min(first.bottom, second.bottom)
  return right > left && bottom > top
}

function extractTextFromTextLayer(
  textLayer: HTMLDivElement | null,
  dragRect: PdfHighlightRect
) {
  if (!textLayer) {
    return ""
  }

  const matches = Array.from(textLayer.querySelectorAll("span"))
    .map((node) => ({
      text: node.textContent ?? "",
      rect: node.getBoundingClientRect()
    }))
    .filter((item) => item.text.trim())
    .filter((item) =>
      intersects(
        item.rect,
        DOMRect.fromRect({
          x: dragRect.left,
          y: dragRect.top,
          width: dragRect.width,
          height: dragRect.height
        })
      )
    )
    .map((item) => item.text)

  return matches.join(" ").replace(/\s+/g, " ").trim()
}

export function PdfPageView({
  pdfDocument,
  pageNumber,
  highlights,
  boxSelectionEnabled,
  onPageMouseUp,
  onPageBoxSelect,
  pageRef
}: {
  pdfDocument: any
  pageNumber: number
  highlights: Highlight[]
  boxSelectionEnabled: boolean
  onPageMouseUp: (pageIndex: number, pageElement: HTMLDivElement | null) => void
  onPageBoxSelect: (
    pageIndex: number,
    pageElement: HTMLDivElement | null,
    dragRect: PdfHighlightRect,
    selectedText: string
  ) => void
  pageRef: (element: HTMLDivElement | null) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!pdfDocument) {
      return
    }
    let disposed = false

    async function renderPage() {
      const page = await pdfDocument.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.35 })
      const canvas = canvasRef.current
      const textLayer = textLayerRef.current
      if (!canvas || !textLayer || disposed) {
        return
      }
      const outputScale = window.devicePixelRatio || 1
      const context = canvas.getContext("2d")
      if (!context) {
        return
      }
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      textLayer.replaceChildren()
      textLayer.style.width = `${Math.floor(viewport.width)}px`
      textLayer.style.height = `${Math.floor(viewport.height)}px`
      setSize({ width: viewport.width, height: viewport.height })
      await page.render({
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        background: "rgb(255,255,255)"
      }).promise
      const textContent = await page.getTextContent()
      const pdfjs = await getPdfjsModule()
      const textLayerRenderer = new pdfjs.TextLayer({
        textContentSource: textContent,
        container: textLayer,
        viewport
      })
      await textLayerRenderer.render()
      page.cleanup()
    }

    renderPage().catch(() => undefined)
    return () => {
      disposed = true
    }
  }, [pageNumber, pdfDocument])

  const draftRect = useMemo(() => {
    if (!dragStart || !dragCurrent) {
      return null
    }
    return buildRectFromPoints(dragStart, dragCurrent)
  }, [dragCurrent, dragStart])

  if (!pdfDocument) {
    return (
      <div
        className="mx-auto mb-8 rounded-xl border border-border/60 bg-surface/50"
        style={{ width: 720, height: 960 }}
      />
    )
  }

  return (
    <div
      ref={(element) => {
        containerRef.current = element
        pageRef(element)
      }}
      className="relative mx-auto mb-8"
      style={{ width: size.width || undefined, minHeight: size.height || 400 }}
      data-pdf-page={pageNumber}
      onMouseUp={() => {
        if (!boxSelectionEnabled) {
          onPageMouseUp(pageNumber - 1, containerRef.current)
        }
      }}
      onMouseDown={(event) => {
        if (!boxSelectionEnabled || !containerRef.current) {
          return
        }
        event.preventDefault()
        setDragStart({ x: event.clientX, y: event.clientY })
        setDragCurrent({ x: event.clientX, y: event.clientY })
      }}
      onMouseMove={(event) => {
        if (!boxSelectionEnabled || !dragStart) {
          return
        }
        setDragCurrent({ x: event.clientX, y: event.clientY })
      }}
      onMouseLeave={() => {
        if (!boxSelectionEnabled || !dragStart) {
          return
        }
        setDragStart(null)
        setDragCurrent(null)
      }}
      onMouseUpCapture={() => {
        if (!boxSelectionEnabled || !containerRef.current || !draftRect) {
          return
        }
        const normalized = normalizePdfDragRect({
          pageRect: containerRef.current.getBoundingClientRect(),
          dragRect: draftRect
        })
        const selectedText = extractTextFromTextLayer(textLayerRef.current, draftRect)
        setDragStart(null)
        setDragCurrent(null)
        if (!normalized || normalized.width < 8 || normalized.height < 8) {
          return
        }
        onPageBoxSelect(pageNumber - 1, containerRef.current, draftRect, selectedText)
      }}
    >
      <canvas
        ref={canvasRef}
        className="block rounded-xl border border-black/15 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
      />
      <div
        ref={textLayerRef}
        className="lumina-pdf-text-layer absolute left-0 top-0"
      />
      <div className="pointer-events-none absolute left-0 top-0" style={{ width: size.width, height: size.height }}>
        {highlights.flatMap((item) =>
          buildHighlightRects(item).map((rect, index) => (
            <PdfHighlightRectView key={`${item.id}-${index}`} rect={rect} color={item.color} />
          ))
        )}
        {draftRect ? (
          <DraftSelectionRect containerRef={containerRef} draftRect={draftRect} />
        ) : null}
      </div>
      {boxSelectionEnabled ? (
        <div className="pointer-events-none absolute inset-0 rounded-xl border border-primary/30" />
      ) : null}
    </div>
  )
}

const DraftSelectionRect = memo(function DraftSelectionRect({
  containerRef,
  draftRect
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  draftRect: { left: number; top: number; width: number; height: number }
}) {
  const containerRect = containerRef.current?.getBoundingClientRect()
  const offsetLeft = containerRect?.left ?? 0
  const offsetTop = containerRect?.top ?? 0
  return (
    <div
      className="absolute rounded border border-primary/70 bg-primary/10"
      style={{
        left: draftRect.left - offsetLeft,
        top: draftRect.top - offsetTop,
        width: draftRect.width,
        height: draftRect.height
      }}
    />
  )
})

function PdfHighlightRectView({
  rect,
  color
}: {
  rect: PdfHighlightRect
  color: Highlight["color"]
}) {
  const colorMap = {
    yellow: "rgba(251,191,36,0.35)",
    green: "rgba(52,211,153,0.35)",
    blue: "rgba(96,165,250,0.35)",
    pink: "rgba(244,114,182,0.35)"
  } as const

  return (
    <div
      className="absolute rounded-[4px]"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        backgroundColor: colorMap[color]
      }}
    />
  )
}
