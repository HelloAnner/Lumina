/**
 * 文章翻译状态 Hook
 * 管理文章的原文/译文切换和翻译请求
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useState } from "react"
import type { ArticleSection, TranslationDisplayMode } from "@/src/server/store/types"

const DEFAULT_TARGET_LANGUAGE = "zh-CN"

export function useArticleTranslation({
  articleId,
  originalSections,
  onError
}: {
  articleId: string
  originalSections: ArticleSection[]
  onError: (message: string) => void
}) {
  const [translationView, setTranslationView] = useState<TranslationDisplayMode>("original")
  const [translatedContent, setTranslatedContent] = useState<ArticleSection[] | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [targetLanguage] = useState(DEFAULT_TARGET_LANGUAGE)

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
    } catch (error) {
      const message = error instanceof Error ? error.message : "翻译失败"
      setTranslationError(message)
      setTranslationView("original")
      onError(message)
    } finally {
      setIsTranslating(false)
    }
  }, [articleId, onError, targetLanguage, translatedContent])

  const toggleTranslationView = useCallback(() => {
    setTranslationError(null)
    setTranslationView((current) => {
      const next = current === "translation" ? "original" : "translation"
      if (next === "translation" && !translatedContent) {
        void fetchTranslation()
      }
      return next
    })
  }, [fetchTranslation, translatedContent])

  const displayContent =
    translationView === "translation" && translatedContent
      ? translatedContent
      : originalSections

  return {
    translationView,
    toggleTranslationView,
    targetLanguage,
    displayContent,
    translatedContent,
    isTranslating,
    translationError,
    clearTranslationError: useCallback(() => setTranslationError(null), [])
  }
}
