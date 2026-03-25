/**
 * 文章翻译状态 Hook
 * 管理文章的原文/译文切换和翻译请求，持久化语言偏好
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ArticleSection, TranslationDisplayMode } from "@/src/server/store/types"

const DEFAULT_TARGET_LANGUAGE = "zh-CN"

export function useArticleTranslation({
  articleId,
  articleTitle,
  originalSections,
  initialView,
  initialTranslatedTitle,
  onError
}: {
  articleId: string
  articleTitle: string
  originalSections: ArticleSection[]
  initialView: TranslationDisplayMode
  initialTranslatedTitle?: string
  onError: (message: string) => void
}) {
  const [translationView, setTranslationView] = useState<TranslationDisplayMode>(initialView)
  const [translatedContent, setTranslatedContent] = useState<ArticleSection[] | null>(null)
  const [translatedTitle, setTranslatedTitle] = useState(initialTranslatedTitle ?? "")
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [targetLanguage] = useState(DEFAULT_TARGET_LANGUAGE)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** 持久化翻译视图偏好 */
  const persistView = useCallback(
    (view: TranslationDisplayMode) => {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current)
      }
      persistTimer.current = setTimeout(() => {
        fetch(`/api/articles/${articleId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ translationView: view })
        }).catch(() => undefined)
      }, 200)
    },
    [articleId]
  )

  const fetchTranslation = useCallback(async () => {
    if (translatedContent) {
      return
    }
    setIsTranslating(true)
    try {
      const res = await fetch(`/api/translations/articles/${articleId}/prefetch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetLanguage })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "翻译失败")
      }
      setTranslationError(null)
      setTranslatedContent(data.content)
      if (data.translatedTitle) {
        setTranslatedTitle(data.translatedTitle)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "翻译失败"
      setTranslationError(message)
      setTranslationView("original")
      onError(message)
    } finally {
      setIsTranslating(false)
    }
  }, [articleId, onError, targetLanguage, translatedContent])

  // 初始视图为翻译时，自动拉取译文
  useEffect(() => {
    if (initialView === "translation" && !translatedContent && !isTranslating) {
      void fetchTranslation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const viewRef = useRef(translationView)
  viewRef.current = translationView

  const toggleTranslationView = useCallback(() => {
    setTranslationError(null)
    const next = viewRef.current === "translation" ? "original" : "translation"
    setTranslationView(next)
    persistView(next)
    // 切到译文且尚无缓存时发起翻译，放在 setState 之外确保 isTranslating 独立触发渲染
    if (next === "translation" && !translatedContent) {
      void fetchTranslation()
    }
  }, [fetchTranslation, persistView, translatedContent])

  const displayTitle =
    translationView === "translation" && translatedTitle
      ? translatedTitle
      : articleTitle

  const displayContent =
    translationView === "translation" && translatedContent
      ? translatedContent
      : originalSections

  return {
    translationView,
    toggleTranslationView,
    targetLanguage,
    displayTitle,
    displayContent,
    translatedContent,
    isTranslating,
    translationError,
    clearTranslationError: useCallback(() => setTranslationError(null), [])
  }
}
