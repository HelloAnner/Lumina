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
import type {
  ArticleTranslation,
  Highlight,
  HighlightColor,
  ReaderSettings,
  ReaderTheme,
  ScoutArticle
} from "@/src/server/store/types"
import type { ResolvedHighlight, SharedReaderView } from "@/components/reader/reader-types"
import {
  buildArticleProgressSnapshot,
  resolveArticleProgressSectionIndex,
  type ArticleProgressRecord
} from "@/src/server/services/reading/progress"
import { buildParagraphSegments } from "@/components/reader/reader-highlight-utils"
import {
  buildArticleHighlightPayload,
  buildArticleParagraphLayouts,
  buildArticleVirtualContent,
  resolveArticleHighlight
} from "@/components/articles/article-highlight-utils"
import { buildArticleOutlineEntries } from "@/components/articles/article-outline-utils"
import {
  readGuestArticleOutlineWidth,
  saveGuestArticleOutlineWidth
} from "@/components/reader/reader-width-storage"
import { useArticleTranslation } from "@/components/articles/use-article-translation"
import type {
  ReaderLayoutState as PersistedReaderLayoutState,
  UiPreferences
} from "@/src/server/services/preferences/store"
import { buildHighlightNoteState } from "@/components/reader/highlight-note-state"

const COLORS = {
  yellow: "rgba(251,191,36,0.35)",
  green: "rgba(52,211,153,0.35)",
  blue: "rgba(96,165,250,0.35)",
  pink: "rgba(244,114,182,0.35)"
} as const

export interface ArticleReaderProps {
  article: ScoutArticle
  highlights: Highlight[]
  initialProgress: ArticleProgressRecord
  initialWidths: UiPreferences
  initialLayout: PersistedReaderLayoutState
  settings?: ReaderSettings
  initialTranslation?: ArticleTranslation | null
  sharedView?: SharedReaderView
}

export function useArticleReaderController({
  article,
  highlights,
  initialProgress,
  initialWidths,
  settings,
  initialTranslation,
  sharedView
}: ArticleReaderProps) {
  const readOnly = sharedView?.readOnly ?? false
  const [articleState, setArticleState] = useState(article)
  const [selectedText, setSelectedText] = useState("")
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null)
  const [selectionRect, setSelectionRect] = useState<{
    selectionTop: number
    selectionBottom: number
    selectionCenterX: number
    containerWidth: number
  } | null>(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [panelItems, setPanelItems] = useState(() => sortHighlightsByCreatedAt(highlights))
  const [toast, setToast] = useState("")
  const [scrollProgress, setScrollProgress] = useState(() =>
    Math.round((initialProgress.progress || article.readProgress) * 100)
  )
  const [fontSize, setFontSize] = useState<ReaderSettings["fontSize"]>(settings?.fontSize ?? 16)
  const [lineHeight, setLineHeight] = useState<ReaderSettings["lineHeight"]>(settings?.lineHeight ?? 2)
  const [letterSpacing, setLetterSpacing] = useState(0)
  const [fontFamily, setFontFamily] = useState<ReaderSettings["fontFamily"]>(settings?.fontFamily ?? "system")
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(settings?.theme ?? "day")
  const [showFontPanel, setShowFontPanel] = useState(false)
  const [outlineWidth, setOutlineWidth] = useState(initialWidths.articleOutlineWidth)
  const [highlightsWidth, setHighlightsWidth] = useState(initialWidths.readerHighlightsWidth)
  const [refetching, setRefetching] = useState(false)

  const fontPanelRef = useRef<HTMLDivElement | null>(null)
  const readerMainRef = useRef<HTMLElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const paragraphRefs = useRef<Record<string, HTMLElement | null>>({})
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preferredSectionIndex = useMemo(
    () => resolveArticleProgressSectionIndex(articleState, initialProgress),
    [articleState, initialProgress]
  )

  useEffect(() => {
    if (!readOnly) {
      return
    }
    setOutlineWidth(readGuestArticleOutlineWidth(initialWidths.articleOutlineWidth))
  }, [initialWidths.articleOutlineWidth, readOnly])

  const translation = useArticleTranslation({
    articleId: articleState.id,
    articleTitle: articleState.title,
    originalSections: articleState.content,
    initialView: articleState.translationView ?? "original",
    initialTranslatedContent: initialTranslation?.content ?? null,
    initialTranslatedTitle: articleState.translatedTitle,
    readOnly,
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
    setSelectedRange(null)
    window.getSelection()?.removeAllRanges()
  }, [panelItems])

  // 渲染段落（带高亮标记）
  const renderParagraphContent = useCallback(
    (paragraphText: string, paragraphStart: number, sectionIndex: number) => {
      const sectionHighlights = highlightsBySection.get(sectionIndex) ?? []
      const segments = buildParagraphSegments(paragraphText, paragraphStart, sectionHighlights)
      return segments.map((segment, index) =>
        segment.activeHighlightId ? (
          <mark
            key={`${segment.activeHighlightId}-${paragraphStart}-${index}`}
            className="cursor-pointer rounded-[4px] px-[1px] text-inherit"
            style={{ backgroundColor: COLORS[segment.color!] }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              openHighlightNoteComposer(segment.activeHighlightId!)
            }}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`${paragraphStart}-${index}`}>{segment.text}</span>
        )
      )
    },
    [highlightsBySection, openHighlightNoteComposer]
  )

  // 选区捕获
  const handleMouseUp = useCallback(() => {
    if (readOnly) {
      setSelectedText("")
      setSelectedRange(null)
      setSelectionRect(null)
      return
    }
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
  }, [readOnly])

  // 进入阅读器时标记为「阅读中」（归档文章同时恢复）
  useEffect(() => {
    if (readOnly) {
      return
    }
    const updates: Record<string, unknown> = {}
    if (!articleState.reading) {
      updates.reading = true
    }
    if (articleState.archived) {
      updates.archived = false
    }
    if (Object.keys(updates).length > 0) {
      fetch(`/api/articles/${articleState.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates)
      }).catch(() => undefined)
    }
  }, [articleState.archived, articleState.id, articleState.reading, readOnly])

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
      if (readOnly) {
        saveGuestArticleOutlineWidth(outlineWidth)
        return
      }
      await fetch("/api/preferences/ui", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          readerHighlightsWidth: Math.round(highlightsWidth),
          articleOutlineWidth: Math.round(outlineWidth)
        })
      })
    }, 180)
    return () => {
      if (prefTimer.current) {
        clearTimeout(prefTimer.current)
      }
    }
  }, [highlightsWidth, outlineWidth, readOnly])

  useEffect(() => {
    if (preferredSectionIndex <= 0) {
      return
    }
    const timer = window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current
      const target = container?.querySelector(
        `[data-article-section-index="${preferredSectionIndex}"]`
      ) as HTMLElement | null
      target?.scrollIntoView({ behavior: "auto", block: "start" })
    })
    return () => window.cancelAnimationFrame(timer)
  }, [preferredSectionIndex])

  // 进度追踪
  const persistProgress = useCallback(() => {
    if (readOnly) {
      return
    }
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
      const activeSectionIndex = findCurrentArticleSectionIndex(container, preferredSectionIndex)
      const nextProgress = buildArticleProgressSnapshot(
        articleState,
        activeSectionIndex,
        scrollPercent
      )
      setScrollProgress(Math.round(nextProgress.progress * 100))
      setArticleState((current) => ({
        ...current,
        readProgress: nextProgress.progress,
        lastReadPosition: nextProgress.currentPageId,
        lastReadAt: new Date().toISOString()
      }))
      fetch(`/api/articles/${articleState.id}/progress`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextProgress)
      }).catch(() => undefined)
    }, 300)
  }, [articleState, preferredSectionIndex, readOnly])

  const handleScroll = useCallback(() => {
    persistProgress()
  }, [persistProgress])

  // 文章大纲（从 heading blocks 提取）
  const outlineEntries = useMemo(
    () => buildArticleOutlineEntries(translation.displayContent),
    [translation.displayContent]
  )

  // 创建高亮
  const createHighlight = useCallback(
    async (color: keyof typeof COLORS, note?: string) => {
      if (readOnly) {
        return
      }
      if (!selectedText || !selectedRange) {
        return
      }
      const counterpartVirtualContent =
        activeContentMode === "translation" && articleState.content
          ? buildArticleVirtualContent(articleState.content)
          : activeContentMode === "original" && translation.translatedContent
            ? buildArticleVirtualContent(translation.translatedContent)
            : undefined

      const payload = buildArticleHighlightPayload({
        articleId: articleState.id,
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
        setPanelItems((current) => mergeHighlightItem(current, data.item))
        if (note) {
          setToast("想法已记录")
        }
      }
      setSelectedText("")
      setSelectedRange(null)
      setSelectionRect(null)
      setComposerOpen(false)
      setEditingHighlightId(null)
      setNoteDraft("")
      window.getSelection()?.removeAllRanges()
    },
    [activeContentMode, articleState.content, articleState.id, readOnly, selectedRange, selectedText, translation.targetLanguage, translation.translatedContent]
  )

  const resolveSectionTitle = useCallback((sectionIndex: number) => {
    const nearestOutline = [...outlineEntries]
      .reverse()
      .find((item) => item.index <= sectionIndex)
    return nearestOutline?.title || articleState.title
  }, [articleState.title, outlineEntries])

  const createImageHighlight = useCallback(
    async (
      input: {
        sectionIndex: number
        imageUrl: string
        imageAlt?: string
        imageObjectKey?: string
      },
      immediateSync = false
    ) => {
      const sectionTitle = resolveSectionTitle(input.sectionIndex)
      const response = await fetch("/api/highlights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookId: articleState.id,
          format: "EPUB",
          assetType: "image",
          sourceType: "article",
          articleId: articleState.id,
          sourceTitle: articleState.title,
          sourceSectionTitle: sectionTitle,
          imageUrl: input.imageUrl,
          imageObjectKey: input.imageObjectKey,
          imageAlt: input.imageAlt,
          content: input.imageAlt?.trim() || `${sectionTitle} 图片`,
          color: immediateSync ? "blue" : "yellow",
          immediateSync
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.item) {
        setToast(data.error || "图片操作失败")
        return
      }
      setPanelItems((current) => mergeHighlightItem(current, data.item))
      setToast(immediateSync ? "图片已转入知识库" : "图片已收藏")
    },
    [articleState.id, articleState.title, outlineEntries, resolveSectionTitle]
  )

  const deleteHighlight = useCallback(async (highlightId: string) => {
    if (readOnly) {
      return
    }
    const response = await fetch(`/api/highlights/${highlightId}`, { method: "DELETE" })
    if (response.ok) {
      setPanelItems((current) => current.filter((item) => item.id !== highlightId))
    }
  }, [readOnly])

  const openHighlight = useCallback((item: ResolvedHighlight) => {
    // 滚动到高亮位置
    const layouts = buildArticleParagraphLayouts(translation.displayContent)
    const targetLayout = layouts.find((l) => item.start >= l.start && item.start < l.end)
    if (targetLayout) {
      const el = paragraphRefs.current[`0-${targetLayout.index}`]
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [translation.displayContent])

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

  // 重新获取正文
  const handleRefetch = useCallback(async () => {
    if (!articleState.sourceUrl) {
      return
    }
    setRefetching(true)
    try {
      const res = await fetch(`/api/articles/${articleState.id}/refetch`, { method: "POST" })
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
  }, [articleState.id, articleState.sourceUrl])

  const toggleFavorite = useCallback(async () => {
    if (readOnly) {
      return
    }
    const response = await fetch(
      `/api/articles/${articleState.id}/${articleState.favorite ? "unfavorite" : "favorite"}`,
      { method: "POST" }
    )
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.item) {
      setToast(data.error || "收藏操作失败")
      return
    }
    setArticleState(data.item)
    setToast(articleState.favorite ? "已取消收藏" : "已收藏")
  }, [articleState.favorite, articleState.id, readOnly])

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

  // 读进度百分比
  return {
    article: articleState,
    displayTitle: translation.displayTitle,
    displayContent: translation.displayContent,
    outlineEntries,
    scrollProgress,
    groupedHighlights,
    resolvedHighlights,
    selectionRect,
    selectedText,
    noteDraft,
    editingHighlightId,
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
    outlineWidth,
    highlightsWidth,
    fontPanelRef,
    readerMainRef,
    scrollContainerRef,
    paragraphRefs,
    renderParagraphContent,
    handleScroll,
    handleMouseUp,
    handleRefetch,
    toggleFavorite,
    createImageHighlight,
    openHighlight,
    openHighlightNoteComposer,
    toggleTranslationView: translation.toggleTranslationView,
    createHighlight,
    saveNote,
    deleteHighlight,
    createResizeHandler,
    setToast,
    setNoteDraft,
    setEditingHighlightId,
    setComposerOpen,
    setShowFontPanel,
    setFontSize,
    setLineHeight,
    setLetterSpacing,
    setFontFamily,
    setReaderTheme,
    setOutlineWidth,
    setHighlightsWidth
  }
}

function findCurrentArticleSectionIndex(container: HTMLDivElement, fallback: number) {
  const containerTop = container.getBoundingClientRect().top
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>("[data-article-section-index]")
  )
  let activeIndex = fallback
  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    if (rect.top - containerTop <= 160) {
      activeIndex = Number(node.dataset.articleSectionIndex ?? activeIndex)
    }
  }
  return activeIndex
}

function sortHighlightsByCreatedAt(items: Highlight[]) {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

function mergeHighlightItem(items: Highlight[], nextItem: Highlight) {
  const exists = items.some((item) => item.id === nextItem.id)
  if (!exists) {
    return [...items, nextItem]
  }
  return items.map((item) => (item.id === nextItem.id ? nextItem : item))
}
