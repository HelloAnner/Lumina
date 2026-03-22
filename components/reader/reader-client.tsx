"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Highlighter, Lightbulb, ListTree } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Toast } from "@/components/ui/toast"
import type { Book, Highlight, ReaderSettings } from "@/src/server/store/types"
import type { ReaderProgressRecord } from "@/src/server/services/books/progress"

const COLORS = {
  yellow: "rgba(251,191,36,0.35)",
  green: "rgba(52,211,153,0.35)",
  blue: "rgba(96,165,250,0.35)",
  pink: "rgba(244,114,182,0.35)"
} as const

function splitParagraphs(content: string) {
  return content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

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
  settings
}: {
  book: Book
  highlights: Highlight[]
  initialProgress: ReaderProgressRecord
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
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(preferredSectionIndex)
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(
    null
  )
  const [noteDraft, setNoteDraft] = useState("")
  const [composerOpen, setComposerOpen] = useState(false)
  const [panelItems, setPanelItems] = useState(highlights)
  const [toast, setToast] = useState("")
  const wheelAccumulatorRef = useRef(0)
  const wheelLockRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const paragraphRefs = useRef<Record<string, HTMLParagraphElement | null>>({})
  const tickingRef = useRef(false)

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
  const paragraphWindow = 4
  const safeParagraphIndex = Math.min(
    paragraphIndex,
    Math.max(0, currentParagraphs.length - 1)
  )
  const visibleParagraphs = useMemo(
    () =>
      currentParagraphs.slice(safeParagraphIndex, safeParagraphIndex + paragraphWindow),
    [currentParagraphs, safeParagraphIndex]
  )

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

  const goSection = useCallback(
    (nextIndex: number) => {
      const safeIndex = Math.min(book.content.length - 1, Math.max(0, nextIndex))
      setPageIndex(safeIndex)
      setParagraphIndex(0)
      if (isVertical) {
        sectionRefs.current[safeIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        })
      }
    },
    [book.content.length, isVertical]
  )

  const stepParagraph = useCallback(
    (step: number) => {
      setParagraphIndex((current) => {
        const next = current + step
        if (next < 0) {
          if (pageIndex > 0) {
            goSection(pageIndex - 1)
            const previousParagraphs = splitParagraphs(
              book.content[pageIndex - 1]?.content ?? ""
            )
            return Math.max(0, previousParagraphs.length - paragraphWindow)
          }
          return 0
        }
        if (next >= currentParagraphs.length) {
          if (pageIndex < book.content.length - 1) {
            goSection(pageIndex + 1)
            return 0
          }
          return Math.max(0, currentParagraphs.length - 1)
        }
        return next
      })
    },
    [book.content, currentParagraphs.length, goSection, pageIndex]
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
    sectionRefs.current[preferredSectionIndex]?.scrollIntoView({
      block: "start"
    })
  }, [isVertical, preferredSectionIndex])

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

  async function createHighlight(color: keyof typeof COLORS, note?: string) {
    if (!selectedText) {
      return
    }
    const response = await fetch("/api/highlights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookId: book.id,
        format: book.format,
        pageIndex: book.content[selectedSectionIndex]?.pageIndex ?? currentSection.pageIndex,
        content: selectedText,
        note,
        color
      })
    })
    const data = await response.json()
    if (response.ok) {
      setPanelItems((current) => [data.item, ...current])
      setToast(note ? "想法已记录" : "高亮已添加")
    }
    setSelectedText("")
    setSelectionRect(null)
    setComposerOpen(false)
    setNoteDraft("")
    window.getSelection()?.removeAllRanges()
  }

  function handleMouseUp() {
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ""
    if (!text || !selection || selection.rangeCount === 0) {
      setSelectedText("")
      setSelectionRect(null)
      return
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    const anchor =
      selection.anchorNode instanceof Element
        ? selection.anchorNode
        : selection.anchorNode?.parentElement
    const owner = anchor?.closest("[data-section-index]")
    const sectionIndex = Number(owner?.getAttribute("data-section-index") ?? pageIndex)
    setSelectedSectionIndex(sectionIndex)
    setSelectedText(text)
    setSelectionRect({
      top: rect.top + window.scrollY - 54,
      left: rect.left + window.scrollX + rect.width / 2 - 54
    })
  }

  function renderSidebarNode(node: SidebarNode, depth = 0): React.ReactNode {
    const active = node.sourceIndex === pageIndex
    return (
      <div key={`${node.id}-${node.sourceIndex}`}>
        <button
          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
            active
              ? "bg-elevated text-foreground ring-1 ring-primary/25"
              : "text-secondary hover:bg-overlay hover:text-foreground"
          }`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => goSection(node.sourceIndex)}
        >
          <span className={`truncate ${depth > 0 ? "text-[13px]" : ""}`}>
            {depth > 0 ? "· " : ""}
            {node.title}
          </span>
          <span className="ml-2 text-xs">{node.sourceIndex + 1}</span>
        </button>
        {node.children.length > 0 ? (
          <div className="ml-4 mt-1 space-y-1 border-l border-border/70 pl-2">
            {node.children.map((child) => renderSidebarNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    )
  }

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

      <div className="grid h-[calc(100vh-52px)] grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="border-r border-border bg-[#0D0D0F]">
          <div className="flex h-12 items-center gap-2 border-b border-border px-4 text-sm font-medium">
            <ListTree className="h-4 w-4 text-primary" />
            目录
          </div>
          <div className="space-y-1 p-2">
            {sidebarEntries.map((node) => renderSidebarNode(node))}
          </div>
        </aside>

        <main
          className="relative h-full overflow-hidden bg-[#0D0D0F]"
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
              className="h-full overflow-y-auto scroll-smooth px-12 py-10"
              onScroll={handleScroll}
            >
              <div className="mx-auto max-w-3xl space-y-8">
                {book.content.map((section, sectionIndex) => {
                  const paragraphs = splitParagraphs(section.content)
                  return (
                    <div
                      key={section.id}
                      ref={(element) => {
                        sectionRefs.current[sectionIndex] = element
                      }}
                      data-section-index={sectionIndex}
                      className="rounded-[28px] border border-white/6 bg-[#111113] px-14 py-14 shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
                    >
                      <h2 className="mb-8 text-[28px] font-semibold tracking-tight text-foreground">
                        {section.title}
                      </h2>
                      <div className="space-y-8 text-[20px] leading-[2.15] tracking-[0.01em] text-[#F5F5F5] selection:bg-amber-300/40">
                        {paragraphs.map((paragraph, paragraphIdx) => (
                          <p
                            key={`${section.id}-${paragraphIdx}`}
                            ref={(element) => {
                              paragraphRefs.current[`${sectionIndex}-${paragraphIdx}`] = element
                            }}
                            className={paragraphIdx === 0 ? "pl-4" : "indent-8"}
                            onMouseUp={handleMouseUp}
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="h-full w-full max-w-5xl px-12 py-10">
              <div className="mx-auto flex h-full max-w-3xl flex-col justify-center">
                <div className="rounded-[32px] border border-white/6 bg-[#111113] px-16 py-16 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
                  <h1 className="mb-10 text-[30px] font-semibold leading-tight tracking-tight text-foreground">
                    {currentSection?.title ?? book.title}
                  </h1>
                  <div
                    className="space-y-9 text-[20px] leading-[2.28] tracking-[0.01em] text-[#F5F5F5] selection:bg-amber-300/40"
                    onMouseUp={handleMouseUp}
                    data-section-index={pageIndex}
                  >
                    {visibleParagraphs.map((paragraph, index) => (
                      <p
                        key={`${currentSection.id}-${safeParagraphIndex + index}`}
                        className={
                          index === 0
                            ? "relative pl-4 before:absolute before:left-0 before:top-3 before:h-2 before:w-2 before:rounded-full before:bg-primary/70"
                            : "indent-8"
                        }
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  <div className="mt-10 flex items-center justify-between text-xs text-secondary">
                    <span>
                      当前定位：第 {pageIndex + 1} 章 · 段落{" "}
                      {Math.min(safeParagraphIndex + 1, Math.max(1, currentParagraphs.length))}
                    </span>
                    <span>左右模式下，触控板/滚轮上下滑动即可翻章</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <aside className="border-l border-border bg-surface">
          <div className="flex h-12 items-center justify-between border-b border-border px-4 text-sm">
            <span>划线与想法</span>
            <span>{panelItems.length}</span>
          </div>
          <div className="h-[calc(100%-48px)] space-y-3 overflow-y-auto p-4">
            {groupedHighlights.map((item) => (
              <Card
                key={item.id}
                className={`space-y-3 p-4 ${
                  item.pageIndex === currentSection?.pageIndex
                    ? "border-primary/20"
                    : "border-border"
                }`}
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
            ))}
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
