/**
 * PDF 阅读器状态编排 Hook
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { normalizePdfSelectionRects } from "@/components/reader/pdf-highlight-utils"
import {
  buildClientRectsSnapshot,
  buildPdfSidebarNodes,
  findCurrentPdfPageIndex,
  scrollElementIntoReader
} from "@/components/reader/pdf-reader-utils"
import type { ReaderClientProps } from "@/components/reader/reader-types"
import type { Highlight } from "@/src/server/store/types"

async function fetchPdfFileUrl(bookId: string) {
  const response = await fetch(`/api/books/${bookId}/access-url`)
  if (!response.ok) {
    return ""
  }
  const data = await response.json()
  return typeof data.fileUrl === "string" ? data.fileUrl : ""
}

async function loadPdfDocument(fileUrl: string) {
  const pdfjs = await import("pdfjs-dist/webpack.mjs")
  const task = pdfjs.getDocument(fileUrl)
  return task.promise
}

export function usePdfReaderController({
  book,
  highlights,
  initialProgress,
  initialWidths
}: ReaderClientProps) {
  const initialPageIndex = Math.max(0, initialProgress.currentSectionIndex || 0)
  const [fileUrl, setFileUrl] = useState("")
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [pageCount, setPageCount] = useState(Math.max(book.totalPages ?? 0, book.content.length, 1))
  const [currentPageIndex, setCurrentPageIndex] = useState(initialPageIndex)
  const [panelItems, setPanelItems] = useState(highlights.filter((item) => item.format === "PDF"))
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null)
  const [selectedText, setSelectedText] = useState("")
  const [selectedPageIndex, setSelectedPageIndex] = useState(0)
  const [selectedRects, setSelectedRects] = useState<Highlight["pdfRects"]>([])
  const [composerOpen, setComposerOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [toast, setToast] = useState("")
  const [loading, setLoading] = useState(true)
  const [fallbackMessage, setFallbackMessage] = useState("")
  const [tocWidth, setTocWidth] = useState(initialWidths.readerTocWidth)
  const [highlightsWidth, setHighlightsWidth] = useState(initialWidths.readerHighlightsWidth)
  const readerMainRef = useRef<HTMLElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const tocItemRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickingRef = useRef(false)

  const sidebarEntries = useMemo(() => buildPdfSidebarNodes(book.toc, pageCount), [book.toc, pageCount])
  const pageNumbers = useMemo(() => {
    if (!pdfDocument) {
      return []
    }
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }, [pageCount, pdfDocument])
  const highlightsByPage = useMemo(() => {
    const map = new Map<number, Highlight[]>()
    panelItems.forEach((item) => {
      const pageNumber = item.pageIndex ?? 1
      const bucket = map.get(pageNumber) ?? []
      bucket.push(item)
      map.set(pageNumber, bucket)
    })
    return map
  }, [panelItems])

  useEffect(() => {
    let disposed = false

    fetchPdfFileUrl(book.id)
      .then((nextUrl) => {
        if (disposed) {
          return
        }
        if (!nextUrl) {
          setFallbackMessage("当前 PDF 原文件不可用，先展示已解析的文本结果。")
          setLoading(false)
          return
        }
        setFileUrl(nextUrl)
      })
      .catch(() => {
        if (!disposed) {
          setFallbackMessage("当前 PDF 加载失败，先展示已解析的文本结果。")
          setLoading(false)
        }
      })

    return () => {
      disposed = true
    }
  }, [book.id])

  useEffect(() => {
    if (!fileUrl) {
      return
    }
    let disposed = false
    let activeDocument: any = null

    loadPdfDocument(fileUrl)
      .then((document) => {
        if (disposed) {
          return document.destroy()
        }
        activeDocument = document
        setPdfDocument(document)
        setPageCount(document.numPages)
        setLoading(false)
      })
      .catch(() => {
        if (!disposed) {
          setFallbackMessage("当前 PDF 解析失败，先展示已解析的文本结果。")
          setLoading(false)
        }
      })

    return () => {
      disposed = true
      if (activeDocument) {
        activeDocument.destroy().catch(() => undefined)
      }
    }
  }, [fileUrl])

  useEffect(() => {
    if (!pdfDocument) {
      return
    }
    const timer = window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current
      const target = pageRefs.current[Math.min(initialPageIndex, pageCount - 1)]
      if (!container || !target) {
        return
      }
      scrollElementIntoReader(container, target)
    })
    return () => window.cancelAnimationFrame(timer)
  }, [initialPageIndex, pageCount, pdfDocument])

  useEffect(() => {
    if (prefTimer.current) {
      clearTimeout(prefTimer.current)
    }
    prefTimer.current = setTimeout(async () => {
      await fetch("/api/preferences/ui", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          readerTocWidth: Math.round(tocWidth),
          readerHighlightsWidth: Math.round(highlightsWidth)
        })
      })
    }, 180)
    return () => {
      if (prefTimer.current) {
        clearTimeout(prefTimer.current)
      }
    }
  }, [highlightsWidth, tocWidth])

  useEffect(() => {
    if (!pageCount) {
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/books/${book.id}/progress`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          progress: (currentPageIndex + 1) / Math.max(pageCount, 1),
          currentSectionIndex: currentPageIndex,
          currentParagraphIndex: 0
        })
      }).catch(() => undefined)
    }, 120)
    return () => clearTimeout(timer)
  }, [book.id, currentPageIndex, pageCount])

  const createResizeHandler = useCallback(
    (
      initialWidth: number,
      onResize: (width: number) => void,
      bounds: { min: number; max: number },
      reverse = false
    ) => {
      return (event: React.MouseEvent) => {
        event.preventDefault()
        const startX = event.clientX
        const move = (moveEvent: MouseEvent) => {
          const delta = moveEvent.clientX - startX
          const nextWidth = reverse ? initialWidth - delta : initialWidth + delta
          onResize(Math.min(bounds.max, Math.max(bounds.min, nextWidth)))
        }
        const up = () => {
          window.removeEventListener("mousemove", move)
          window.removeEventListener("mouseup", up)
        }
        window.addEventListener("mousemove", move)
        window.addEventListener("mouseup", up)
      }
    },
    []
  )

  const setPageRef = useCallback((pageIndex: number, element: HTMLDivElement | null) => {
    pageRefs.current[pageIndex] = element
  }, [])

  const goPage = useCallback((pageIndex: number) => {
    const container = scrollContainerRef.current
    const target = pageRefs.current[pageIndex]
    if (!container || !target) {
      return
    }
    setCurrentPageIndex(pageIndex)
    scrollElementIntoReader(container, target)
  }, [])

  const openHighlight = useCallback((item: Highlight) => {
    const pageIndex = Math.max(0, (item.pageIndex ?? 1) - 1)
    const container = scrollContainerRef.current
    const target = pageRefs.current[pageIndex]
    if (!container || !target) {
      return
    }
    setCurrentPageIndex(pageIndex)
    scrollElementIntoReader(container, target, 16)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedText("")
    setSelectedRects([])
    setSelectionRect(null)
    setComposerOpen(false)
    setNoteDraft("")
    window.getSelection()?.removeAllRanges()
  }, [])

  const handlePageMouseUp = useCallback(
    (pageIndex: number, pageElement: HTMLDivElement | null) => {
      const selection = window.getSelection()
      const text = selection?.toString().trim() ?? ""
      if (!selection || selection.rangeCount === 0 || !text || !pageElement) {
        clearSelection()
        return
      }
      const range = selection.getRangeAt(0)
      const pageRect = pageElement.getBoundingClientRect()
      const normalizedRects = normalizePdfSelectionRects({
        pageRect: {
          left: pageRect.left,
          top: pageRect.top,
          width: pageRect.width,
          height: pageRect.height
        },
        clientRects: buildClientRectsSnapshot(range)
      })
      const toolbarRect = range.getBoundingClientRect()
      const mainRect = readerMainRef.current?.getBoundingClientRect()
      if (!normalizedRects.length || !mainRect) {
        clearSelection()
        return
      }
      setSelectedText(text)
      setSelectedRects(normalizedRects)
      setSelectedPageIndex(pageIndex)
      setSelectionRect({
        top: Math.max(12, toolbarRect.top - mainRect.top - 54),
        left: Math.max(12, toolbarRect.left - mainRect.left + toolbarRect.width / 2 - 54)
      })
    },
    [clearSelection]
  )

  const createHighlight = useCallback(
    async (color: Highlight["color"], note?: string) => {
      if (!selectedText || !selectedRects?.length) {
        return
      }
      const response = await fetch("/api/highlights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          format: "PDF",
          pageIndex: selectedPageIndex + 1,
          pdfRects: selectedRects,
          content: selectedText,
          note,
          color
        })
      })
      const data = await response.json()
      if (response.ok) {
        setPanelItems((current) => [data.item, ...current])
        if (note) {
          setToast("想法已记录")
        }
      }
      clearSelection()
    },
    [book.id, clearSelection, selectedPageIndex, selectedRects, selectedText]
  )

  const deleteHighlight = useCallback(
    async (highlightId: string) => {
      const response = await fetch(`/api/highlights/${highlightId}`, {
        method: "DELETE"
      })
      if (response.ok) {
        setPanelItems((current) => current.filter((item) => item.id !== highlightId))
      }
    },
    []
  )

  const handleScroll = useCallback(() => {
    if (tickingRef.current) {
      return
    }
    tickingRef.current = true
    window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current
      if (container) {
        setCurrentPageIndex((current) =>
          findCurrentPdfPageIndex(
            container.getBoundingClientRect().top,
            pageRefs.current,
            current
          )
        )
      }
      tickingRef.current = false
    })
  }, [])

  return {
    book,
    pdfDocument,
    pageCount,
    currentPageIndex,
    panelItems,
    sidebarEntries,
    pageNumbers,
    highlightsByPage,
    selectionRect,
    selectedText,
    composerOpen,
    noteDraft,
    toast,
    loading,
    fallbackMessage,
    tocWidth,
    highlightsWidth,
    readerMainRef,
    scrollContainerRef,
    tocItemRefs,
    createResizeHandler,
    setPageRef,
    goPage,
    openHighlight,
    handlePageMouseUp,
    createHighlight,
    deleteHighlight,
    handleScroll,
    setComposerOpen,
    setNoteDraft,
    setToast,
    setTocWidth,
    setHighlightsWidth
  }
}
