/**
 * PDF 单页渲染
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import { useEffect, useRef, useState } from "react"
import type { Highlight, PdfHighlightRect } from "@/src/server/store/types"

function buildHighlightRects(item: Highlight) {
  return Array.isArray(item.pdfRects) ? item.pdfRects : []
}

export function PdfPageView({
  pdfDocument,
  pageNumber,
  highlights,
  onPageMouseUp,
  pageRef
}: {
  pdfDocument: any
  pageNumber: number
  highlights: Highlight[]
  onPageMouseUp: (pageIndex: number, pageElement: HTMLDivElement | null) => void
  pageRef: (element: HTMLDivElement | null) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

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
      const pdfjs = await import("pdfjs-dist/webpack.mjs")
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
      onMouseUp={() => onPageMouseUp(pageNumber - 1, containerRef.current)}
    >
      <canvas
        ref={canvasRef}
        className="block rounded-xl border border-black/15 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
      />
      <div ref={textLayerRef} className="lumina-pdf-text-layer absolute left-0 top-0" />
      <div className="pointer-events-none absolute left-0 top-0" style={{ width: size.width, height: size.height }}>
        {highlights.flatMap((item) =>
          buildHighlightRects(item).map((rect, index) => (
            <PdfHighlightRectView key={`${item.id}-${index}`} rect={rect} color={item.color} />
          ))
        )}
      </div>
    </div>
  )
}

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
