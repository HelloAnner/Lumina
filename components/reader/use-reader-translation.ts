/**
 * 阅读器译文状态 Hook
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  buildDisplayToc,
  buildTranslationPrefetchPlan
} from "@/components/reader/reader-translation-utils"
import type {
  Book,
  BookTocTranslation,
  BookTranslation,
  TranslationDisplayMode
} from "@/src/server/store/types"

function buildDisplaySection(
  section: Book["content"][number],
  translated: BookTranslation | null
) {
  if (!translated) {
    return section
  }
  return {
    ...section,
    content: translated.content,
    blocks: translated.blocks
  }
}

function indexItemsBySection(items: BookTranslation[]) {
  return items.reduce<Record<number, BookTranslation>>((result, item) => {
    result[item.sectionIndex] = item
    return result
  }, {})
}

function mergeTranslationItems(
  current: Record<number, BookTranslation>,
  items: BookTranslation[]
) {
  return {
    ...current,
    ...indexItemsBySection(items)
  }
}

const DEFAULT_TARGET_LANGUAGE = "zh-CN"

export function useReaderTranslation({
  book,
  pageIndex,
  initialView,
  initialTargetLanguage,
  onError
}: {
  book: Book
  pageIndex: number
  initialView: TranslationDisplayMode
  initialTargetLanguage?: string
  onError: (message: string) => void
}) {
  const [translationView, setTranslationView] = useState<TranslationDisplayMode>(initialView)
  const [targetLanguage, setTargetLanguage] = useState(initialTargetLanguage || DEFAULT_TARGET_LANGUAGE)
  const [translationItems, setTranslationItems] = useState<Record<number, BookTranslation>>({})
  const [tocTranslation, setTocTranslation] = useState<BookTocTranslation | null>(null)
  const [busyIndexes, setBusyIndexes] = useState<number[]>([])
  const [translationError, setTranslationError] = useState<string | null>(null)
  const activeBookIdRef = useRef(book.id)

  useEffect(() => {
    if (activeBookIdRef.current === book.id) {
      return
    }
    activeBookIdRef.current = book.id
    setTranslationItems({})
    setTocTranslation(null)
    setBusyIndexes([])
    setTranslationView(initialView)
  }, [book.id, initialView])

  const translatedSectionIndexes = useMemo(() => {
    return Object.keys(translationItems).map((item) => Number(item))
  }, [translationItems])

  const currentTranslation = translationItems[pageIndex] ?? null

  const displayContent = useMemo(() => {
    if (translationView !== "translation") {
      return book.content
    }
    return book.content.map((section, index) => {
      return buildDisplaySection(section, translationItems[index] ?? null)
    })
  }, [book.content, translationItems, translationView])

  const displayToc = useMemo(() => {
    return buildDisplayToc(book.toc, tocTranslation, translationView)
  }, [book.toc, tocTranslation, translationView])

  const fetchTranslations = useCallback(
    async (sectionIndexes: number[], shouldFallbackToOriginal: boolean) => {
      if (sectionIndexes.length === 0) {
        return
      }
      setBusyIndexes((current) => Array.from(new Set([...current, ...sectionIndexes])))
      try {
        const response = await fetch(`/api/translations/books/${book.id}/prefetch`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sectionIndexes,
            targetLanguage
          })
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "翻译失败")
        }
        setTranslationError(null)
        setTranslationItems((current) => mergeTranslationItems(current, data.items || []))
        // 仅在服务端返回了新的 TOC 翻译时才更新，避免覆盖已有的老翻译
        if (data.toc) {
          setTocTranslation(data.toc)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "翻译失败"
        setTranslationError(message)
        if (shouldFallbackToOriginal) {
          setTranslationView("original")
        }
        onError(message)
      } finally {
        setBusyIndexes((current) => current.filter((item) => !sectionIndexes.includes(item)))
      }
    },
    [book.id, onError, targetLanguage]
  )

  // 防抖：频繁滚动时聚合翻译请求，等待 400ms 稳定后再触发
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (translationView !== "translation") {
      return
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      const plan = buildTranslationPrefetchPlan({
        currentIndex: pageIndex,
        totalSections: book.content.length,
        cachedIndexes: translatedSectionIndexes,
        busyIndexes
      })
      void fetchTranslations(plan.requestedSectionIndexes, plan.urgentSectionIndexes.length > 0)
    }, 400)
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [
    book.content.length,
    busyIndexes,
    fetchTranslations,
    pageIndex,
    translatedSectionIndexes,
    translationView
  ])

  const toggleTranslationView = useCallback(() => {
    setTranslationError(null)
    setTranslationView((current) => {
      return current === "translation" ? "original" : "translation"
    })
  }, [])

  return {
    translationView,
    toggleTranslationView,
    targetLanguage,
    displayContent,
    displayToc,
    currentTranslation,
    tocTranslation,
    translationItems,
    translationError,
    clearTranslationError: useCallback(() => setTranslationError(null), []),
    isCurrentSectionTranslating: busyIndexes.includes(pageIndex)
  }
}
