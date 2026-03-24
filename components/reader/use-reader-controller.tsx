/**
 * 阅读器状态编排 Hook
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReaderSettings } from "@/src/server/store/types"
import type { ReaderClientProps, ResolvedHighlight } from "@/components/reader/reader-types"
import {
  buildTextHighlightPayload,
  buildParagraphLayouts,
  buildParagraphSegments,
  resolveBookHighlightAnchor,
  splitParagraphs
} from "@/components/reader/reader-highlight-utils"
import { buildSidebarTree, normalizeSidebarTitle } from "@/components/reader/reader-sidebar-utils"

const COLORS = {
  yellow: "rgba(251,191,36,0.35)",
  green: "rgba(52,211,153,0.35)",
  blue: "rgba(96,165,250,0.35)",
  pink: "rgba(244,114,182,0.35)"
} as const

export function useReaderController({
  book,
  highlights,
  initialProgress,
  initialWidths,
  settings
}: ReaderClientProps) {
  const direction = settings?.navigationMode ?? "horizontal"
  const isVertical = direction === "vertical"
  const preferredSectionIndex = useMemo(() => {
    if (initialProgress.currentSectionIndex > 0) {
      return initialProgress.currentSectionIndex
    }
    const index = book.toc.findIndex((item) =>
      /^(第\s*\d+\s*章|第一部分|第二部分|第三部分)/.test(item.title)
    )
    return index >= 0 ? index : 0
  }, [book.toc, initialProgress.currentSectionIndex])

  const [pageIndex, setPageIndex] = useState(preferredSectionIndex)
  const [paragraphIndex, setParagraphIndex] = useState(
    initialProgress.currentParagraphIndex || 0
  )
  const [selectedText, setSelectedText] = useState("")
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(
    null
  )
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(preferredSectionIndex)
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(
    null
  )
  const [noteDraft, setNoteDraft] = useState("")
  const [composerOpen, setComposerOpen] = useState(false)
  const [panelItems, setPanelItems] = useState(highlights)
  const [toast, setToast] = useState("")
  const [fontSize, setFontSize] = useState<ReaderSettings["fontSize"]>(
    settings?.fontSize ?? 16
  )
  const [lineHeight, setLineHeight] = useState<ReaderSettings["lineHeight"]>(
    settings?.lineHeight ?? 2
  )
  const [letterSpacing, setLetterSpacing] = useState(0)
  const [showFontPanel, setShowFontPanel] = useState(false)
  const [tocWidth, setTocWidth] = useState(initialWidths.readerTocWidth)
  const [highlightsWidth, setHighlightsWidth] = useState(
    initialWidths.readerHighlightsWidth
  )
  const fontPanelRef = useRef<HTMLDivElement | null>(null)
  const readerMainRef = useRef<HTMLElement | null>(null)
  const wheelAccumulatorRef = useRef(0)
  const wheelLockRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const paragraphRefs = useRef<Record<string, HTMLParagraphElement | null>>({})
  const tocItemRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const tickingRef = useRef(false)
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sidebarEntries = useMemo(
    () =>
      buildSidebarTree(
        book.toc
          .map((item, index) => {
            const contentTitle = book.content[index]?.title ?? `第 ${index + 1} 节`
            return {
              ...item,
              sourceIndex: index,
              title: normalizeSidebarTitle(item.title, contentTitle, index)
            }
          })
          .filter((item) => {
            if (item.sourceIndex === pageIndex) {
              return true
            }
            return !["封面", "扉页"].includes(item.title)
          })
      ),
    [book.content, book.toc, pageIndex]
  )

  const currentSection = book.content[pageIndex] ?? book.content[0]
  const currentParagraphs = useMemo(
    () => splitParagraphs(currentSection?.content ?? ""),
    [currentSection?.content]
  )
  const paragraphWindow = 8
  const safeParagraphIndex = Math.min(
    paragraphIndex,
    Math.max(0, currentParagraphs.length - 1)
  )
  const currentParagraphLayouts = useMemo(
    () => buildParagraphLayouts(currentSection?.content ?? ""),
    [currentSection?.content]
  )
  const visibleParagraphs = useMemo(
    () =>
      currentParagraphLayouts.slice(
        safeParagraphIndex,
        safeParagraphIndex + paragraphWindow
      ),
    [currentParagraphLayouts, safeParagraphIndex]
  )
  const resolvedHighlights = useMemo<ResolvedHighlight[]>(
    () =>
      panelItems
        .map((item) => {
          const anchor = resolveBookHighlightAnchor(book.content, item)
          if (!anchor) {
            return null
          }
          return { ...item, ...anchor }
        })
        .filter((item): item is ResolvedHighlight => Boolean(item)),
    [book.content, panelItems]
  )
  const highlightsBySection = useMemo(() => {
    const map = new Map<number, ResolvedHighlight[]>()
    resolvedHighlights.forEach((item) => {
      const bucket = map.get(item.sectionIndex) ?? []
      bucket.push(item)
      map.set(item.sectionIndex, bucket)
    })
    return map
  }, [resolvedHighlights])

  const persistProgress = useCallback(
    (sectionIndex: number, paraIndex: number) => {
      const timer = setTimeout(() => {
        fetch(`/api/books/${book.id}/progress`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            progress: (sectionIndex + 1) / Math.max(book.content.length, 1),
            currentSectionIndex: sectionIndex,
            currentParagraphIndex: paraIndex
          })
        }).catch(() => undefined)
      }, 120)
      return () => clearTimeout(timer)
    },
    [book.content.length, book.id]
  )

  useEffect(() => persistProgress(pageIndex, safeParagraphIndex), [
    pageIndex,
    persistProgress,
    safeParagraphIndex
  ])

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

  const scrollToReadingPosition = useCallback(
    (sectionIndex: number, paraIndex: number) => {
      if (!isVertical) {
        return
      }
      const container = scrollContainerRef.current
      const target =
        paragraphRefs.current[`${sectionIndex}-${paraIndex}`] ??
        sectionRefs.current[sectionIndex]
      if (!container || !target) {
        return
      }
      const top =
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        24
      container.scrollTo({
        top: Math.max(0, top),
        behavior: "auto"
      })
    },
    [isVertical]
  )

  const jumpToPosition = useCallback(
    (sectionIndex: number, paraIndex: number) => {
      const safeSectionIndex = Math.min(book.content.length - 1, Math.max(0, sectionIndex))
      const layouts = buildParagraphLayouts(book.content[safeSectionIndex]?.content ?? "")
      const safeParagraph = Math.min(Math.max(0, paraIndex), Math.max(0, layouts.length - 1))
      setSelectedText("")
      setSelectedRange(null)
      setSelectionRect(null)
      setComposerOpen(false)
      window.getSelection()?.removeAllRanges()
      setPageIndex(safeSectionIndex)
      setParagraphIndex(safeParagraph)
      if (isVertical) {
        window.requestAnimationFrame(() => {
          scrollToReadingPosition(safeSectionIndex, safeParagraph)
        })
      }
    },
    [book.content, isVertical, scrollToReadingPosition]
  )

  const goSection = useCallback(
    (nextIndex: number) => {
      jumpToPosition(nextIndex, 0)
    },
    [jumpToPosition]
  )

  const updateVerticalProgress = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }
    const containerTop = container.getBoundingClientRect().top
    let activeSection = pageIndex
    Object.entries(sectionRefs.current).forEach(([key, element]) => {
      if (!element) {
        return
      }
      const rect = element.getBoundingClientRect()
      if (rect.top - containerTop <= 140) {
        activeSection = Number(key)
      }
    })

    let activeParagraph = 0
    const paragraphs = splitParagraphs(book.content[activeSection]?.content ?? "")
    for (let index = 0; index < paragraphs.length; index += 1) {
      const paragraph = paragraphRefs.current[`${activeSection}-${index}`]
      if (!paragraph) {
        continue
      }
      const rect = paragraph.getBoundingClientRect()
      if (rect.top - containerTop <= 180) {
        activeParagraph = index
      }
    }

    setPageIndex(activeSection)
    setParagraphIndex(activeParagraph)
  }, [book.content, pageIndex])

  useEffect(() => {
    if (!isVertical || !scrollContainerRef.current) {
      return
    }
    const timer = window.requestAnimationFrame(() => {
      scrollToReadingPosition(preferredSectionIndex, initialProgress.currentParagraphIndex || 0)
    })
    return () => window.cancelAnimationFrame(timer)
  }, [
    initialProgress.currentParagraphIndex,
    isVertical,
    preferredSectionIndex,
    scrollToReadingPosition
  ])

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
    function handleKeydown(event: KeyboardEvent) {
      if (isVertical) {
        return
      }
      if (event.key === "ArrowRight" || event.key === " ") {
        goSection(pageIndex + 1)
      }
      if (event.key === "ArrowLeft") {
        goSection(pageIndex - 1)
      }
    }
    window.addEventListener("keydown", handleKeydown)
    return () => window.removeEventListener("keydown", handleKeydown)
  }, [goSection, isVertical, pageIndex])

  useEffect(() => {
    if (!showFontPanel) {
      return
    }
    function handleOutsideClick(event: MouseEvent) {
      if (fontPanelRef.current && !fontPanelRef.current.contains(event.target as Node)) {
        setShowFontPanel(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [showFontPanel])

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (isVertical) {
        return
      }
      event.preventDefault()
      if (wheelLockRef.current) {
        return
      }
      const delta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
      wheelAccumulatorRef.current += delta
      if (Math.abs(wheelAccumulatorRef.current) < 70) {
        return
      }
      goSection(pageIndex + (wheelAccumulatorRef.current > 0 ? 1 : -1))
      wheelAccumulatorRef.current = 0
      wheelLockRef.current = true
      window.setTimeout(() => {
        wheelLockRef.current = false
      }, 180)
    },
    [goSection, isVertical, pageIndex]
  )

  const handleScroll = useCallback(() => {
    if (tickingRef.current) {
      return
    }
    tickingRef.current = true
    window.requestAnimationFrame(() => {
      updateVerticalProgress()
      tickingRef.current = false
    })
  }, [updateVerticalProgress])

  const groupedHighlights = useMemo(() => panelItems, [panelItems])

  const renderParagraphContent = useCallback(
    (paragraphText: string, paragraphStart: number, sectionIndex: number) => {
      const sectionHighlights = highlightsBySection.get(sectionIndex) ?? []
      const segments = buildParagraphSegments(paragraphText, paragraphStart, sectionHighlights)
      return segments.map((segment, index) =>
        segment.activeHighlightId ? (
          <mark
            key={`${segment.activeHighlightId}-${paragraphStart}-${index}`}
            className="rounded-[4px] px-[1px] text-inherit"
            style={{ backgroundColor: COLORS[segment.color!] }}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`${paragraphStart}-${index}`}>{segment.text}</span>
        )
      )
    },
    [highlightsBySection]
  )

  const openHighlight = useCallback(
    (item: ResolvedHighlight) => {
      jumpToPosition(item.sectionIndex, item.paragraphIndex)
    },
    [jumpToPosition]
  )

  const createHighlight = useCallback(
    async (color: keyof typeof COLORS, note?: string) => {
      if (!selectedText || !selectedRange) {
        return
      }
      const response = await fetch("/api/highlights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          buildTextHighlightPayload({
            bookId: book.id,
            format: book.format,
            sections: book.content,
            selectedSectionIndex,
            fallbackSection: currentSection,
            selectedText,
            selectedRange,
            note,
            color
          })
        )
      })
      const data = await response.json()
      if (response.ok) {
        setPanelItems((current) => [data.item, ...current])
        if (note) {
          setToast("想法已记录")
        }
      }
      setSelectedText("")
      setSelectedRange(null)
      setSelectionRect(null)
      setComposerOpen(false)
      setNoteDraft("")
      window.getSelection()?.removeAllRanges()
    },
    [
      book.content,
      book.format,
      book.id,
      currentSection,
      selectedRange,
      selectedSectionIndex,
      selectedText
    ]
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

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    const rawText = selection?.toString() ?? ""
    const text = rawText.trim()
    if (!text || !selection || selection.rangeCount === 0) {
      setSelectedText("")
      setSelectedRange(null)
      setSelectionRect(null)
      return
    }
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const anchor =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement
    const owner = anchor?.closest("[data-section-index][data-paragraph-start]")
    const sectionIndex = Number(owner?.getAttribute("data-section-index") ?? pageIndex)
    const paragraphStart = Number(owner?.getAttribute("data-paragraph-start") ?? 0)
    if (!owner || Number.isNaN(paragraphStart)) {
      setSelectedText("")
      setSelectedRange(null)
      setSelectionRect(null)
      return
    }
    const startRange = document.createRange()
    startRange.setStart(owner, 0)
    startRange.setEnd(range.startContainer, range.startOffset)
    const endRange = document.createRange()
    endRange.setStart(owner, 0)
    endRange.setEnd(range.endContainer, range.endOffset)
    const leadingTrim = rawText.length - rawText.trimStart().length
    const trailingTrim = rawText.length - rawText.trimEnd().length
    const start = paragraphStart + startRange.toString().length + leadingTrim
    const end = paragraphStart + endRange.toString().length - trailingTrim
    if (end <= start) {
      setSelectedText("")
      setSelectedRange(null)
      setSelectionRect(null)
      return
    }
    setSelectedSectionIndex(sectionIndex)
    setSelectedText(text)
    setSelectedRange({ start, end })
    const mainRect = readerMainRef.current?.getBoundingClientRect()
    if (!mainRect) {
      setSelectionRect(null)
      return
    }
    const left = rect.left - mainRect.left + rect.width / 2 - 54
    const top = rect.top - mainRect.top - 54
    setSelectionRect({
      top: Math.max(12, top),
      left: Math.max(12, left)
    })
  }, [pageIndex])

  return {
    book,
    isVertical,
    currentSection,
    currentParagraphs,
    pageIndex,
    safeParagraphIndex,
    visibleParagraphs,
    sidebarEntries,
    groupedHighlights,
    resolvedHighlights,
    selectionRect,
    selectedText,
    noteDraft,
    composerOpen,
    toast,
    fontSize,
    lineHeight,
    letterSpacing,
    showFontPanel,
    tocWidth,
    highlightsWidth,
    fontPanelRef,
    readerMainRef,
    scrollContainerRef,
    sectionRefs,
    paragraphRefs,
    tocItemRefs,
    renderParagraphContent,
    handleWheel,
    handleScroll,
    handleMouseUp,
    goSection,
    openHighlight,
    createHighlight,
    deleteHighlight,
    createResizeHandler,
    setToast,
    setNoteDraft,
    setComposerOpen,
    setShowFontPanel,
    setFontSize,
    setLineHeight,
    setLetterSpacing,
    setTocWidth,
    setHighlightsWidth
  }
}
