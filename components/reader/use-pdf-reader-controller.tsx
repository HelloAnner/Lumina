/**
 * PDF 原生阅读控制器
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { normalizePdfDragRect, normalizePdfSelectionRects, type PdfHighlightRect } from "@/components/reader/pdf-highlight-utils"
import {
  buildClientRectsSnapshot,
  buildPdfSidebarNodes,
  findCurrentPdfPageIndex,
  scrollElementIntoReader
} from "@/components/reader/pdf-reader-utils"
import {
  readGuestReaderTocWidth,
  saveGuestReaderTocWidth
} from "@/components/reader/reader-width-storage"
import type { ReaderClientProps } from "@/components/reader/reader-types"
import type { Highlight } from "@/src/server/store/types"
import { buildHighlightNoteState } from "@/components/reader/highlight-note-state"
import {
  buildBookProgressSnapshot,
  resolveBookProgressSectionIndex
} from "@/src/server/services/reading/progress"

async function fetchPdfFileUrl(bookId: string, providedUrl?: string) {
  if (providedUrl) {
    return providedUrl
  }
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

function buildBoxSelectionText(pageIndex: number, selectedText: string) {
  const text = selectedText.trim()
  if (text) {
    return text
  }
  return `第 ${pageIndex + 1} 页区域标注`
}

export function usePdfReaderController({
  book,
  highlights,
  initialProgress,
  initialWidths,
  sharedView
}: ReaderClientProps) {
  const readOnly = sharedView?.readOnly ?? false
  const initialPageIndex = Math.max(0, resolveBookProgressSectionIndex(book, initialProgress))
  const [fileUrl, setFileUrl] = useState("")
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [pageCount, setPageCount] = useState(Math.max(book.totalPages ?? 0, book.content.length, 1))
  const [currentPageIndex, setCurrentPageIndex] = useState(initialPageIndex)
  const [panelItems, setPanelItems] = useState(() =>
    highlights
      .filter((item) => item.format === "PDF")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  )
  const [selectionRect, setSelectionRect] = useState<{
    selectionTop: number
    selectionBottom: number
    selectionCenterX: number
    containerWidth: number
  } | null>(null)
  const [selectedText, setSelectedText] = useState("")
  const [selectedPageIndex, setSelectedPageIndex] = useState(0)
  const [selectedRects, setSelectedRects] = useState<Highlight["pdfRects"]>([])
  const [composerOpen, setComposerOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null)
  const [toast, setToast] = useState("")
  const [loading, setLoading] = useState(true)
  const [fallbackMessage, setFallbackMessage] = useState("")
  const [tocWidth, setTocWidth] = useState(initialWidths.readerTocWidth)
  const [highlightsWidth, setHighlightsWidth] = useState(initialWidths.readerHighlightsWidth)
  const [boxSelectionEnabled, setBoxSelectionEnabled] = useState(false)
  const readerMainRef = useRef<HTMLElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const tocItemRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickingRef = useRef(false)

  useEffect(() => {
    if (!readOnly) {
      return
    }
    setTocWidth(readGuestReaderTocWidth(initialWidths.readerTocWidth))
  }, [initialWidths.readerTocWidth, readOnly])

  const sidebarEntries = useMemo(
    () => buildPdfSidebarNodes(book.toc, pageCount),
    [book.toc, pageCount]
  )
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

    fetchPdfFileUrl(book.id, sharedView?.publicFileUrl)
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
  }, [book.id, sharedView?.publicFileUrl])

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
      if (readOnly) {
        saveGuestReaderTocWidth(tocWidth)
        return
      }
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
  }, [highlightsWidth, readOnly, tocWidth])

  useEffect(() => {
    if (readOnly || !pageCount) {
      return
    }
    const timer = setTimeout(() => {
      const nextProgress = buildBookProgressSnapshot(
        book,
        currentPageIndex,
        0,
        (currentPageIndex + 1) / Math.max(pageCount, 1)
      )
      fetch(`/api/books/${book.id}/progress`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextProgress)
      }).catch(() => undefined)
    }, 120)
    return () => clearTimeout(timer)
  }, [book.id, currentPageIndex, pageCount, readOnly])

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

  const openHighlightNoteComposer = useCallback((highlightId: string) => {
    const target = panelItems.find((item) => item.id === highlightId)
    if (!target) {
      return
    }
    const nextState = buildHighlightNoteState(target)
    setSelectedText(nextState.selectedText)
    setNoteDraft(nextState.noteDraft)
    setEditingHighlightId(nextState.editingHighlightId)
    setComposerOpen(true)
    setSelectionRect(null)
    setSelectedRects([])
    window.getSelection()?.removeAllRanges()
  }, [panelItems])

  const clearSelection = useCallback(() => {
    setSelectedText("")
    setSelectedRects([])
    setSelectionRect(null)
    setComposerOpen(false)
    setEditingHighlightId(null)
    setNoteDraft("")
    window.getSelection()?.removeAllRanges()
  }, [])

  const handlePageMouseUp = useCallback(
    (pageIndex: number, pageElement: HTMLDivElement | null) => {
      if (boxSelectionEnabled) {
        return
      }
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
        selectionTop: toolbarRect.top - mainRect.top,
        selectionBottom: toolbarRect.bottom - mainRect.top,
        selectionCenterX: toolbarRect.left - mainRect.left + toolbarRect.width / 2,
        containerWidth: mainRect.width
      })
    },
    [boxSelectionEnabled, clearSelection]
  )

  const handlePageBoxSelect = useCallback(
    (
      pageIndex: number,
      pageElement: HTMLDivElement | null,
      dragRect: PdfHighlightRect,
      textFromRect: string
    ) => {
      if (!pageElement) {
        clearSelection()
        return
      }
      const normalizedRect = normalizePdfDragRect({
        pageRect: pageElement.getBoundingClientRect(),
        dragRect
      })
      const mainRect = readerMainRef.current?.getBoundingClientRect()
      if (!normalizedRect || !mainRect) {
        clearSelection()
        return
      }
      setSelectedText(buildBoxSelectionText(pageIndex, textFromRect))
      setSelectedRects([normalizedRect])
      setSelectedPageIndex(pageIndex)
      setSelectionRect({
        selectionTop: dragRect.top - mainRect.top,
        selectionBottom: dragRect.top + dragRect.height - mainRect.top,
        selectionCenterX: dragRect.left - mainRect.left + dragRect.width / 2,
        containerWidth: mainRect.width
      })
    },
    [clearSelection]
  )

  const createHighlight = useCallback(
    async (color: Highlight["color"], note?: string) => {
      if (readOnly) {
        return
      }
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
        setPanelItems((current) => mergeHighlightItem(current, data.item))
        if (note) {
          setToast("想法已记录")
        }
      }
      clearSelection()
    },
    [book.id, clearSelection, readOnly, selectedPageIndex, selectedRects, selectedText]
  )

  const deleteHighlight = useCallback(
    async (highlightId: string) => {
      if (readOnly) {
        return
      }
      const response = await fetch(`/api/highlights/${highlightId}`, {
        method: "DELETE"
      })
      if (response.ok) {
        setPanelItems((current) => current.filter((item) => item.id !== highlightId))
      }
    },
    [readOnly]
  )

  const saveNote = useCallback(async () => {
    if (editingHighlightId) {
      const response = await fetch(`/api/highlights/${editingHighlightId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: noteDraft })
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.item) {
        setPanelItems((current) => mergeHighlightItem(current, data.item))
        setToast("想法已更新")
      }
      setComposerOpen(false)
      setEditingHighlightId(null)
      setNoteDraft("")
      return
    }
    await createHighlight("yellow", noteDraft)
  }, [createHighlight, editingHighlightId, noteDraft])

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
    editingHighlightId,
    composerOpen,
    noteDraft,
    toast,
    loading,
    fallbackMessage,
    tocWidth,
    highlightsWidth,
    boxSelectionEnabled,
    readerMainRef,
    scrollContainerRef,
    tocItemRefs,
    createResizeHandler,
    setPageRef,
    goPage,
    openHighlight,
    openHighlightNoteComposer,
    handlePageMouseUp,
    handlePageBoxSelect,
    createHighlight,
    saveNote,
    deleteHighlight,
    handleScroll,
    setComposerOpen,
    setNoteDraft,
    setEditingHighlightId,
    setToast,
    setTocWidth,
    setHighlightsWidth,
    setBoxSelectionEnabled
  }
}

function mergeHighlightItem(items: Highlight[], nextItem: Highlight) {
  const exists = items.some((item) => item.id === nextItem.id)
  if (!exists) {
    return [...items, nextItem]
  }
  return items.map((item) => (item.id === nextItem.id ? nextItem : item))
}
