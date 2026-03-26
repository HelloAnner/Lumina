/**
 * 文章大纲生成工具
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import type { ArticleSection } from "@/src/server/store/types"

export interface ArticleOutlineEntry {
  index: number
  title: string
  level: number
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function pickSectionText(section: ArticleSection) {
  if (section.type === "heading" || section.type === "paragraph" || section.type === "blockquote") {
    return normalizeText(section.text ?? "")
  }
  if (section.type === "list") {
    return normalizeText(section.items?.[0] ?? "")
  }
  return ""
}

function shortenTitle(text: string, maxLength = 26) {
  const normalized = normalizeText(text)
  if (!normalized) {
    return ""
  }
  const sentence = normalized.split(/(?<=[。！？.!?])/)[0]?.trim() || normalized
  if (sentence.length <= maxLength) {
    return sentence
  }
  return `${sentence.slice(0, maxLength - 1).trim()}…`
}

function buildFallbackOutlineEntries(sections: ArticleSection[]) {
  const candidates = sections
    .map((section, index) => ({
      index,
      title: shortenTitle(pickSectionText(section)),
      textLength: pickSectionText(section).length
    }))
    .filter((item) => item.title && item.textLength >= 12)

  if (candidates.length === 0) {
    return []
  }

  return candidates.slice(0, 8).map((item, order) => ({
    index: item.index,
    title: item.title,
    level: order === 0 ? 1 : 2
  }))
}

export function buildArticleOutlineEntries(sections: ArticleSection[]): ArticleOutlineEntry[] {
  const headingEntries = sections
    .map((section, index) => {
      if (section.type !== "heading") {
        return null
      }
      const title = shortenTitle(section.text ?? "", 32)
      if (!title) {
        return null
      }
      return {
        index,
        title,
        level: section.level ?? 1
      }
    })
    .filter((item): item is { index: number; title: string; level: 1 | 2 | 3 } => Boolean(item))

  if (headingEntries.length > 0) {
    return headingEntries
  }

  return buildFallbackOutlineEntries(sections)
}
