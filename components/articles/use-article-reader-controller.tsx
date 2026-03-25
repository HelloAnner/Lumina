/**
 * 文章阅读器状态编排 Hook
 * 管理划词高亮、翻译、字体设置、进度追踪
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Highlight, HighlightColor, ReaderSettings, ReaderTheme, ScoutArticle } from "@/src/server/store/types"
import type { ResolvedHighlight } from "@/components/reader/reader-types"
import { buildParagraphSegments } from "@/components/reader/reader-highlight-utils"
import {
  buildArticleHighlightPayload,
  buildArticleParagraphLayouts,
  buildArticleVirtualContent,
  resolveArticleHighlight
} from "@/components/articles/article-highlight-utils"
import { useArticleTranslation } from "@/components/articles/use-article-translation"
import type { UiPreferences } from "@/src/server/services/preferences/store"

const COLORS = {
  yellow: "rgba(251,191,36,0.35)",
  green: "rgba(52,211,153,0.35)",
  blue: "rgba(96,165,250,0.35)",
  pink: "rgba(244,114,182,0.35)"
} as const

export interface ArticleReaderProps {
  article: ScoutArticle
  highlights: Highlight[]
  initialWidths: UiPreferences
  settings?: ReaderSettings
}

export function useArticleReaderController({
  article,
  highlights,
  initialWidths,
  settings
}: ArticleReaderProps) {
  const [selectedText, setSelectedText] = useState("")
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null)
  const [selectionRect, setSelectionRect] = useState<{
    selectionTop: number
    selectionBottom: number
    selectionCenterX: number
    containerWidth: number
  } | null>(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [composerOpen, setComposerOpen] = useState(false)
  const [panelItems, setPanelItems] = useState(highlights)
  const [toast, setToast] = useState("")
  const [fontSize, setFontSize] = useState<ReaderSettings["fontSize"]>(settings?.fontSize ?? 16)
  const [lineHeight, setLineHeight] = useState<ReaderSettings["lineHeight"]>(settings?.lineHeight ?? 2)
  const [letterSpacing, setLetterSpacing] = useState(0)
  const [fontFamily, setFontFamily] = useState<ReaderSettings["fontFamily"]>(settings?.fontFamily ?? "system")
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(settings?.theme ?? "day")
  const [showFontPanel, setShowFontPanel] = useState(false)
  const [highlightsWidth, setHighlightsWidth] = useState(initialWidths.readerHighlightsWidth)
  const [refetching, setRefetching] = useState(false)

  const fontPanelRef = useRef<HTMLDivElement | null>(null)
  const readerMainRef = useRef<HTMLElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const paragraphRefs = useRef<Record<string, HTMLElement | null>>({})
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const translation = useArticleTranslation({
    articleId: article.id,
    articleTitle: article.title,
    originalSections: article.content,
    initialView: article.translationView ?? "original",
    initialTranslatedTitle: article.translatedTitle,
    onError: setToast
  })

  const activeContentMode =
    translation.translationView === "translation" ? "translation" : "original"

  // 高亮解析
  const resolvedHighlights = useMemo<ResolvedHighlight[]>(() => {
    const sections = translation.displayContent
    return panelItems
      .map((item) => {
        const anchor = resolveArticleHighlight(sections, item, activeContentMode)
        if (!anchor) {
          return null
        }
        return {
          ...item,
          ...anchor,
          displayContent:
            (item.contentMode ?? "original") === activeContentMode
              ? item.content
              : item.counterpartContent ?? item.content
        }
      })
      .filter((item): item is ResolvedHighlight => Boolean(item))
  }, [activeContentMode, panelItems, translation.displayContent])

  const highlightsBySection = useMemo(() => {
    const map = new Map<number, ResolvedHighlight[]>()
    resolvedHighlights.forEach((item) => {
      const bucket = map.get(item.sectionIndex) ?? []
      bucket.push(item)
      map.set(item.sectionIndex, bucket)
    })
    return map
  }, [resolvedHighlights])

  const groupedHighlights = useMemo(
    () => resolvedHighlights.map((item) => ({ ...item, content: item.displayContent })),
    [resolvedHighlights]
  )

  // 渲染段落（带高亮标记）
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

  // 选区捕获
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
    setSelectedText(text)
    setSelectedRange({ start, end })
    const mainRect = readerMainRef.current?.getBoundingClientRect()
    if (!mainRect) {
      setSelectionRect(null)
      return
    }
    setSelectionRect({
      selectionTop: rect.top - mainRect.top,
      selectionBottom: rect.bottom - mainRect.top,
      selectionCenterX: rect.left - mainRect.left + rect.width / 2,
      containerWidth: mainRect.width
    })
  }, [])

  // 进入阅读器时标记为「阅读中」（归档文章同时恢复）
  useEffect(() => {
    const updates: Record<string, unknown> = {}
    if (!article.reading) {
      updates.reading = true
    }
    if (article.archived) {
      updates.archived = false
    }
    if (Object.keys(updates).length > 0) {
      fetch(`/api/articles/${article.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates)
      }).catch(() => undefined)
    }
  }, [article.id, article.reading, article.archived])

  // 点击工具栏外清除选区（想法编辑器打开时保留选区）
  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      if (!selectionRect) {
        return
      }
      const target = event.target as Element
      if (
        target.closest("[data-reader-selection-toolbar]") ||
        target.closest("[data-reader-note-composer]")
      ) {
        return
      }
      setSelectionRect(null)
      setSelectedText("")
      setSelectedRange(null)
    }
    document.addEventListener("mousedown", handleDocumentMouseDown)
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown)
  }, [selectionRect])

  // 切换翻译视图时清除选区
  useEffect(() => {
    setSelectedText("")
    setSelectedRange(null)
    setSelectionRect(null)
    setComposerOpen(false)
    window.getSelection()?.removeAllRanges()
  }, [translation.translationView])

  // 字体面板外部点击关闭
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

  // 面板宽度持久化
  useEffect(() => {
    if (prefTimer.current) {
      clearTimeout(prefTimer.current)
    }
    prefTimer.current = setTimeout(async () => {
      await fetch("/api/preferences/ui", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ readerHighlightsWidth: Math.round(highlightsWidth) })
      })
    }, 180)
    return () => {
      if (prefTimer.current) {
        clearTimeout(prefTimer.current)
      }
    }
  }, [highlightsWidth])

  // 进度追踪
  const persistProgress = useCallback(() => {
    if (progressTimer.current) {
      clearTimeout(progressTimer.current)
    }
    progressTimer.current = setTimeout(() => {
      const container = scrollContainerRef.current
      if (!container) {
        return
      }
      const scrollPercent = container.scrollHeight > container.clientHeight
        ? container.scrollTop / (container.scrollHeight - container.clientHeight)
        : 0
      fetch(`/api/articles/${article.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          readProgress: Math.min(1, Math.max(0, scrollPercent)),
          lastReadAt: new Date().toISOString()
        })
      }).catch(() => undefined)
    }, 300)
  }, [article.id])

  const handleScroll = useCallback(() => {
    persistProgress()
  }, [persistProgress])

  // 创建高亮
  const createHighlight = useCallback(
    async (color: keyof typeof COLORS, note?: string) => {
      if (!selectedText || !selectedRange) {
        return
      }
      const counterpartVirtualContent =
        activeContentMode === "translation" && article.content
          ? buildArticleVirtualContent(article.content)
          : activeContentMode === "original" && translation.translatedContent
            ? buildArticleVirtualContent(translation.translatedContent)
            : undefined

      const payload = buildArticleHighlightPayload({
        articleId: article.id,
        selectedText,
        selectedRange,
        contentMode: activeContentMode,
        targetLanguage: activeContentMode === "translation" ? translation.targetLanguage : undefined,
        counterpartVirtualContent,
        color,
        note
      })

      const response = await fetch("/api/highlights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
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
    [activeContentMode, article.content, article.id, selectedRange, selectedText, translation.targetLanguage, translation.translatedContent]
  )

  const deleteHighlight = useCallback(async (highlightId: string) => {
    const response = await fetch(`/api/highlights/${highlightId}`, { method: "DELETE" })
    if (response.ok) {
      setPanelItems((current) => current.filter((item) => item.id !== highlightId))
    }
  }, [])

  const openHighlight = useCallback((item: ResolvedHighlight) => {
    // 滚动到高亮位置
    const layouts = buildArticleParagraphLayouts(translation.displayContent)
    const targetLayout = layouts.find((l) => item.start >= l.start && item.start < l.end)
    if (targetLayout) {
      const el = paragraphRefs.current[`0-${targetLayout.index}`]
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [translation.displayContent])

  // 重新获取正文
  const handleRefetch = useCallback(async () => {
    if (!article.sourceUrl) {
      return
    }
    setRefetching(true)
    try {
      const res = await fetch(`/api/articles/${article.id}/refetch`, { method: "POST" })
      if (res.ok) {
        window.location.reload()
        return
      } else {
        const data = await res.json().catch(() => ({}))
        setToast(data.error || "重新获取失败")
      }
    } catch {
      setToast("网络错误")
    } finally {
      setRefetching(false)
    }
  }, [article.id, article.sourceUrl])

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

  // 文章大纲（从 heading blocks 提取）
  const outlineEntries = useMemo(() => {
    return translation.displayContent
      .map((section, idx) => {
        if (section.type !== "heading") {
          return null
        }
        return { index: idx, title: section.text ?? "", level: section.level ?? 1 }
      })
      .filter(Boolean) as { index: number; title: string; level: number }[]
  }, [translation.displayContent])

  // 读进度百分比
  const scrollProgress = useMemo(() => {
    return Math.round(article.readProgress * 100)
  }, [article.readProgress])

  return {
    article,
    displayTitle: translation.displayTitle,
    displayContent: translation.displayContent,
    outlineEntries,
    scrollProgress,
    groupedHighlights,
    resolvedHighlights,
    selectionRect,
    selectedText,
    noteDraft,
    composerOpen,
    toast,
    refetching,
    translationView: translation.translationView,
    translationError: translation.translationError,
    clearTranslationError: translation.clearTranslationError,
    isTranslating: translation.isTranslating,
    fontSize,
    lineHeight,
    letterSpacing,
    fontFamily,
    readerTheme,
    showFontPanel,
    highlightsWidth,
    fontPanelRef,
    readerMainRef,
    scrollContainerRef,
    paragraphRefs,
    renderParagraphContent,
    handleScroll,
    handleMouseUp,
    handleRefetch,
    openHighlight,
    toggleTranslationView: translation.toggleTranslationView,
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
    setFontFamily,
    setReaderTheme,
    setHighlightsWidth
  }
}
