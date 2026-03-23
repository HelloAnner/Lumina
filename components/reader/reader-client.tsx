"use client"

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react"
import Link from "next/link"
import { ArrowLeft, Highlighter, Lightbulb, ListTree, Type } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Toast } from "@/components/ui/toast"
import type { Book, Highlight, ReaderSettings } from "@/src/server/store/types"
import type { ReaderProgressRecord } from "@/src/server/services/books/progress"
import type { UiPreferences } from "@/src/server/services/preferences/store"
import {
  buildParagraphLayouts,
  buildParagraphSegments,
  resolveBookHighlightAnchor,
  splitParagraphs
} from "@/components/reader/reader-highlight-utils"

const COLORS = {
  yellow: "rgba(251,191,36,0.35)",
  green: "rgba(52,211,153,0.35)",
  blue: "rgba(96,165,250,0.35)",
  pink: "rgba(244,114,182,0.35)"
} as const

function normalizeSidebarTitle(title: string, fallback: string, index: number) {
  if (/^cover$/i.test(title)) {
    return "封面"
  }
  if (/^text\d+$/i.test(title)) {
    return index === 1 ? "扉页" : fallback
  }
  return title
}

function inferSidebarLevel(title: string, fallbackLevel = 0) {
  if (/^第[一二三四五六七八九十0-9]+部分/.test(title)) {
    return 0
  }
  if (/^第\s*\d+\s*章/.test(title) || /^图\d+/.test(title)) {
    return 1
  }
  if (["目录", "图片来源", "致谢", "注释", "封面", "扉页"].includes(title)) {
    return 0
  }
  return fallbackLevel
}

type SidebarNode = {
  id: string
  title: string
  sourceIndex: number
  level: number
  children: SidebarNode[]
}

type ResolvedHighlight = Highlight & {
  sectionIndex: number
  paragraphIndex: number
  start: number
  end: number
}

function buildSidebarTree(
  entries: Array<{
    id: string
    title: string
    sourceIndex: number
    level?: number
  }>
) {
  const roots: SidebarNode[] = []
  let currentParent: SidebarNode | null = null
  let fallbackParent: SidebarNode | null = null

  entries.forEach((entry) => {
    const level = inferSidebarLevel(entry.title, entry.level ?? 0)
    const node: SidebarNode = {
      id: entry.id,
      title: entry.title,
      sourceIndex: entry.sourceIndex,
      level,
      children: []
    }
    if (
      level === 1 &&
      currentParent &&
      !["目录", "封面", "扉页"].includes(currentParent.title)
    ) {
      currentParent.children.push(node)
    } else if (level === 1) {
      if (!fallbackParent) {
        fallbackParent = {
          id: "__body__",
          title: "正文",
          sourceIndex: node.sourceIndex,
          level: 0,
          children: []
        }
        roots.push(fallbackParent)
      }
      fallbackParent.children.push(node)
    } else {
      roots.push(node)
      currentParent = node
    }
  })

  return roots
}

export function ReaderClient({
  book,
  highlights,
  initialProgress,
  initialWidths,
  settings
}: {
  book: Book
  highlights: Highlight[]
  initialProgress: ReaderProgressRecord
  initialWidths: UiPreferences
  settings?: ReaderSettings
}) {
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
  const [selectedRange, setSelectedRange] = useState<{
    start: number
    end: number
  } | null>(null)
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

  const sidebarEntries = useMemo(() => {
    return buildSidebarTree(
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
    )
  }, [book.content, book.toc, pageIndex])

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
          return {
            ...item,
            ...anchor
          }
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
      const safeSectionIndex = Math.min(
        book.content.length - 1,
        Math.max(0, sectionIndex)
      )
      const layouts = buildParagraphLayouts(book.content[safeSectionIndex]?.content ?? "")
      const safeParagraph = Math.min(
        Math.max(0, paraIndex),
        Math.max(0, layouts.length - 1)
      )
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
      scrollToReadingPosition(
        preferredSectionIndex,
        initialProgress.currentParagraphIndex || 0
      )
    })
    return () => window.cancelAnimationFrame(timer)
  }, [
    initialProgress.currentParagraphIndex,
    isVertical,
    preferredSectionIndex,
    scrollToReadingPosition
  ])

  useEffect(() => {
    tocItemRefs.current[pageIndex]?.scrollIntoView({
      block: "nearest"
    })
  }, [pageIndex])

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

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (isVertical) {
      return
    }
    event.preventDefault()
    if (wheelLockRef.current) {
      return
    }
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
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
  }

  function handleScroll() {
    if (tickingRef.current) {
      return
    }
    tickingRef.current = true
    window.requestAnimationFrame(() => {
      updateVerticalProgress()
      tickingRef.current = false
    })
  }

  const groupedHighlights = useMemo(() => panelItems, [panelItems])

  function renderParagraphContent(
    paragraphText: string,
    paragraphStart: number,
    sectionIndex: number
  ) {
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
  }

  function openHighlight(item: ResolvedHighlight) {
    jumpToPosition(item.sectionIndex, item.paragraphIndex)
  }

  async function createHighlight(color: keyof typeof COLORS, note?: string) {
    if (!selectedText || !selectedRange) {
      return
    }
    const response = await fetch("/api/highlights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookId: book.id,
        format: book.format,
        pageIndex: book.content[selectedSectionIndex]?.pageIndex ?? currentSection.pageIndex,
        paraOffsetStart: selectedRange.start,
        paraOffsetEnd: selectedRange.end,
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
    setSelectedText("")
    setSelectedRange(null)
    setSelectionRect(null)
    setComposerOpen(false)
    setNoteDraft("")
    window.getSelection()?.removeAllRanges()
  }

  function handleMouseUp() {
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
    setSelectedRange({
      start,
      end
    })
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
  }

  // 抽取 SidebarNode 为 memoized 组件，避免不必要重渲染
  const SidebarNodeComponent = useMemo(
    () =>
      memo(function SidebarNode({
        node,
        depth,
        activeIndex,
        onNavigate
      }: {
        node: SidebarNode
        depth: number
        activeIndex: number
        onNavigate: (index: number) => void
      }) {
        const active = node.sourceIndex === activeIndex
        return (
          <div key={`${node.id}-${node.sourceIndex}`}>
            <button
              ref={(element) => {
                tocItemRefs.current[node.sourceIndex] = element
              }}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                active
                  ? "bg-elevated text-foreground ring-1 ring-primary/25"
                  : "text-secondary hover:bg-overlay hover:text-foreground"
              }`}
              style={{ paddingLeft: `${12 + depth * 20}px` }}
              onClick={() => onNavigate(node.sourceIndex)}
            >
              <span className={`truncate ${depth > 0 ? "text-[13px]" : ""}`}>
                {depth > 0 ? "· " : ""}
                {node.title}
              </span>
              <span className="ml-2 text-xs">{node.sourceIndex + 1}</span>
            </button>
            {node.children.length > 0 ? (
              <div className="ml-4 mt-1 space-y-1 border-l border-border/70 pl-2">
                {node.children.map((child) => (
                  <SidebarNodeComponent
                    key={`${child.id}-${child.sourceIndex}`}
                    node={child}
                    depth={depth + 1}
                    activeIndex={activeIndex}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )
      }),
    []
  )

  return (
    <div className="h-screen overflow-hidden bg-base">
      {toast ? <Toast title={toast} tone="success" onClose={() => setToast("")} /> : null}
      <div className="flex h-[52px] items-center justify-between border-b border-border bg-surface px-5">
        <div className="flex items-center gap-4 text-sm text-secondary">
          <Link className="flex items-center gap-2 hover:text-foreground" href="/library">
            <ArrowLeft className="h-4 w-4" />
            书库
          </Link>
          <span>{book.title}</span>
        </div>
        <div className="text-xs text-secondary">
          {pageIndex + 1} / {book.content.length}
        </div>
      </div>

      <div className="flex h-[calc(100vh-52px)]">
        <aside
          className="relative border-r border-border bg-reader-sidebar"
          style={{ width: tocWidth }}
        >
          <div className="flex h-12 items-center gap-2 border-b border-border px-4 text-sm font-medium">
            <ListTree className="h-4 w-4 text-primary" />
            目录
          </div>
          <div className="h-[calc(100%-48px)] overflow-y-auto p-2">
            <div className="space-y-1">
              {sidebarEntries.map((node) => (
                <SidebarNodeComponent
                  key={`${node.id}-${node.sourceIndex}`}
                  node={node}
                  depth={0}
                  activeIndex={pageIndex}
                  onNavigate={goSection}
                />
              ))}
            </div>
          </div>
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
            onMouseDown={createResizeHandler(
              tocWidth,
              setTocWidth,
              { min: 200, max: 420 }
            )}
          />
        </aside>

        <main
          ref={readerMainRef}
          className="relative min-w-0 flex-1 overflow-hidden bg-reader-sidebar"
          onWheel={handleWheel}
        >
          {selectionRect ? (
            <div
              className="absolute z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 py-2 shadow-panel"
              style={{ top: selectionRect.top, left: selectionRect.left }}
            >
              <button
                className="rounded-full bg-primary/15 p-2 text-primary transition hover:bg-primary/20"
                onClick={() => createHighlight("yellow")}
                title="高亮"
              >
                <Highlighter className="h-4 w-4" />
              </button>
              <button
                className="rounded-full bg-elevated p-2 text-foreground transition hover:bg-overlay"
                onClick={() => setComposerOpen(true)}
                title="想法"
              >
                <Lightbulb className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {isVertical ? (
            <div
              ref={scrollContainerRef}
              className="h-full overflow-y-auto px-12 py-10"
              onScroll={handleScroll}
            >
              <div className="mx-auto max-w-2xl space-y-12">
                {book.content.map((section, sectionIndex) => {
                  const paragraphs = buildParagraphLayouts(section.content)
                  return (
                    <div
                      key={section.id}
                      ref={(element) => {
                        sectionRefs.current[sectionIndex] = element
                      }}
                      data-section-index={sectionIndex}
                    >
                      <h2 className="mb-8 text-lg font-medium text-foreground">
                        {section.title}
                      </h2>
                      <div
                        className="text-reader-text selection:bg-amber-300/40"
                        style={{
                          fontSize,
                          lineHeight,
                          letterSpacing: `${letterSpacing}em`
                        }}
                      >
                        {paragraphs.map((paragraph) => (
                          <p
                            key={`${section.id}-${paragraph.index}`}
                            ref={(element) => {
                              paragraphRefs.current[
                                `${sectionIndex}-${paragraph.index}`
                              ] = element
                            }}
                            className="mb-5"
                            onMouseUp={handleMouseUp}
                            data-section-index={sectionIndex}
                            data-paragraph-start={paragraph.start}
                          >
                            {renderParagraphContent(
                              paragraph.text,
                              paragraph.start,
                              sectionIndex
                            )}
                          </p>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="h-full w-full px-8 py-12">
              <div className="mx-auto flex h-full max-w-2xl flex-col justify-center">
                <div className="max-w-2xl">
                  <h1 className="mb-10 text-xl font-medium text-foreground">
                    {currentSection?.title ?? book.title}
                  </h1>
                  <div
                    className="text-reader-text selection:bg-amber-300/40"
                    style={{
                      fontSize,
                      lineHeight,
                      letterSpacing: `${letterSpacing}em`
                    }}
                  >
                    {visibleParagraphs.map((paragraph) => (
                      <p
                        key={`${currentSection.id}-${paragraph.index}`}
                        className="mb-5"
                        onMouseUp={handleMouseUp}
                        data-section-index={pageIndex}
                        data-paragraph-start={paragraph.start}
                      >
                        {renderParagraphContent(
                          paragraph.text,
                          paragraph.start,
                          pageIndex
                        )}
                      </p>
                    ))}
                  </div>
                  <div className="mt-12 flex items-center justify-between text-xs text-secondary">
                    <span>
                      第 {pageIndex + 1} 章 · 段落{" "}
                      {Math.min(safeParagraphIndex + 1, Math.max(1, currentParagraphs.length))}
                    </span>
                    <span>滚轮或触控板切换章节</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* 字体设置悬浮按钮 */}
          <div ref={fontPanelRef} className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2">
            {showFontPanel && (
              <div className="mb-2 w-64 rounded-2xl border border-white/10 bg-elevated p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-secondary">
                      <span>字号</span>
                      <span className="tabular-nums">{fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={12}
                      max={22}
                      step={1}
                      value={fontSize}
                      onChange={(e) =>
                        setFontSize(Number(e.target.value) as ReaderSettings["fontSize"])
                      }
                      className="w-full accent-primary"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-muted">
                      <span>小</span>
                      <span>大</span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-secondary">
                      <span>行距</span>
                      <span className="tabular-nums">{lineHeight.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={1.4}
                      max={3.0}
                      step={0.1}
                      value={lineHeight}
                      onChange={(e) =>
                        setLineHeight(
                          Number(e.target.value) as ReaderSettings["lineHeight"]
                        )
                      }
                      className="w-full accent-primary"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-muted">
                      <span>紧凑</span>
                      <span>宽松</span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-secondary">
                      <span>字间距</span>
                      <span className="tabular-nums">{(letterSpacing * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.1}
                      step={0.005}
                      value={letterSpacing}
                      onChange={(e) => setLetterSpacing(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-muted">
                      <span>默认</span>
                      <span>宽</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <button
              className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition ${
                showFontPanel
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-white/10 bg-elevated text-secondary hover:bg-overlay hover:text-foreground"
              }`}
              onClick={() => setShowFontPanel((v) => !v)}
              title="字体设置"
            >
              <Type className="h-5 w-5" />
            </button>
          </div>
        </main>

        <aside
          className="relative border-l border-border bg-surface"
          style={{ width: highlightsWidth }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
            onMouseDown={createResizeHandler(
              highlightsWidth,
              setHighlightsWidth,
              { min: 260, max: 480 },
              true
            )}
          />
          <div className="flex h-12 items-center justify-between border-b border-border px-4 text-sm">
            <span>划线与想法</span>
            <span>{panelItems.length}</span>
          </div>
          <div className="h-[calc(100%-48px)] space-y-3 overflow-y-auto p-4">
            {groupedHighlights.map((item) => {
              const resolved = resolvedHighlights.find((entry) => entry.id === item.id)
              return (
                <Card
                  key={item.id}
                  className={`cursor-pointer space-y-3 p-4 transition ${
                    item.pageIndex === currentSection?.pageIndex
                      ? "border-primary/20"
                      : "border-border"
                  }`}
                  onClick={() => {
                    if (resolved) {
                      openHighlight(resolved)
                    }
                  }}
                >
                  <div
                    className="rounded-md px-3 py-2 text-sm leading-6 text-foreground"
                    style={{ backgroundColor: COLORS[item.color] }}
                  >
                    {item.content}
                  </div>
                  <div className="text-[11px] text-muted">第 {item.pageIndex ?? 0} 节</div>
                  {item.note ? (
                    <div className="text-sm leading-6 text-secondary">{item.note}</div>
                  ) : null}
                </Card>
              )
            })}
          </div>
        </aside>
      </div>

      {composerOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45">
          <Card className="w-full max-w-xl space-y-4 p-6">
            <div className="text-lg font-medium">记录想法</div>
            <div className="rounded-xl bg-elevated px-4 py-3 text-sm leading-6 text-foreground">
              {selectedText}
            </div>
            <Textarea
              placeholder="写下你此刻的理解、联想或问题……"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md px-3 py-2 text-sm text-secondary hover:bg-overlay hover:text-foreground"
                onClick={() => setComposerOpen(false)}
              >
                取消
              </button>
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
                onClick={() => createHighlight("yellow", noteDraft)}
              >
                保存想法
              </button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
