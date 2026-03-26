/**
 * 访客阅读宽度本地存储
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
"use client"

const GUEST_READER_TOC_KEY = "lumina-guest-reader-toc-width"
const GUEST_ARTICLE_OUTLINE_KEY = "lumina-guest-article-outline-width"
const GUEST_ARTICLE_OUTLINE_COLLAPSED_KEY = "lumina-guest-article-outline-collapsed"

function readWidth(key: string, fallback: number, bounds: { min: number; max: number }) {
  if (typeof window === "undefined") {
    return fallback
  }
  const raw = window.localStorage.getItem(key)
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)))
}

function writeWidth(key: string, value: number) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(key, String(Math.round(value)))
}

export function readGuestReaderTocWidth(fallback: number) {
  return readWidth(GUEST_READER_TOC_KEY, fallback, { min: 200, max: 420 })
}

export function saveGuestReaderTocWidth(value: number) {
  writeWidth(GUEST_READER_TOC_KEY, value)
}

export function readGuestArticleOutlineWidth(fallback: number) {
  return readWidth(GUEST_ARTICLE_OUTLINE_KEY, fallback, { min: 180, max: 360 })
}

export function saveGuestArticleOutlineWidth(value: number) {
  writeWidth(GUEST_ARTICLE_OUTLINE_KEY, value)
}

export function readGuestArticleOutlineCollapsed() {
  if (typeof window === "undefined") {
    return false
  }
  return window.localStorage.getItem(GUEST_ARTICLE_OUTLINE_COLLAPSED_KEY) === "1"
}

export function saveGuestArticleOutlineCollapsed(collapsed: boolean) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(
    GUEST_ARTICLE_OUTLINE_COLLAPSED_KEY,
    collapsed ? "1" : "0"
  )
}
