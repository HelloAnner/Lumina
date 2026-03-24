/**
 * 阅读器高亮定位与正文切片工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import { decodeHtmlEntities } from "@/src/lib/html-entities"
import type {
  BookFormat,
  HighlightColor,
  TranslationDisplayMode
} from "@/src/server/store/types"

export interface SectionLike {
  pageIndex: number
  content: string
  href?: string
}

export interface ParagraphLayout {
  index: number
  text: string
  start: number
  end: number
}

export interface HighlightAnchor {
  sectionIndex: number
  paragraphIndex: number
  start: number
  end: number
}

export interface HighlightRange {
  id: string
  color: HighlightColor
  start: number
  end: number
}

export interface ParagraphSegment {
  text: string
  activeHighlightId: string | null
  color: HighlightColor | null
}

export interface BuildTextHighlightPayloadInput {
  bookId: string
  format: BookFormat
  sections: SectionLike[]
  counterpartSections?: SectionLike[]
  selectedSectionIndex: number
  fallbackSection: SectionLike
  selectedText: string
  selectedRange: {
    start: number
    end: number
  }
  contentMode?: TranslationDisplayMode
  targetLanguage?: string
  color: HighlightColor
  note?: string
}

export function splitParagraphs(content: string) {
  return content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function buildParagraphLayouts(content: string): ParagraphLayout[] {
  const paragraphs = splitParagraphs(content)
  let cursor = 0
  return paragraphs.map((text, index) => {
    const start = cursor
    const end = start + text.length
    cursor = end + 2
    return {
      index,
      text,
      start,
      end
    }
  })
}

function normalizeRange(
  content: string,
  highlightTexts: string[],
  start?: number,
  end?: number
) {
  const matchedText = highlightTexts.find(Boolean)
  if (
    matchedText &&
    typeof start === "number" &&
    typeof end === "number" &&
    start >= 0 &&
    end > start &&
    content.slice(start, end) === matchedText
  ) {
    return { start, end }
  }

  for (const highlightText of highlightTexts) {
    const matchedStart = content.indexOf(highlightText)
    if (matchedStart >= 0) {
      return {
        start: matchedStart,
        end: matchedStart + highlightText.length
      }
    }
  }

  return null
}

function findParagraphIndex(layouts: ParagraphLayout[], offset: number) {
  const matched = layouts.find(
    (item) => offset >= item.start && offset < item.end
  )
  if (matched) {
    return matched.index
  }
  return Math.max(0, layouts.length - 1)
}

export function resolveBookHighlightAnchor(
  sections: SectionLike[],
  highlight: {
    content: string
    contentMode?: TranslationDisplayMode
    counterpartContent?: string
    pageIndex?: number
    chapterHref?: string
    paraOffsetStart?: number
    paraOffsetEnd?: number
    counterpartParaOffsetStart?: number
    counterpartParaOffsetEnd?: number
  },
  contentMode: TranslationDisplayMode = "original"
): HighlightAnchor | null {
  const sectionIndex = sections.findIndex((section) => {
    if (highlight.chapterHref && section.href === highlight.chapterHref) {
      return true
    }
    return section.pageIndex === highlight.pageIndex
  })
  if (sectionIndex < 0) {
    return null
  }

  const layouts = buildParagraphLayouts(sections[sectionIndex].content)
  if (!layouts.length) {
    return null
  }
  const normalizedContent = layouts.map((item) => item.text).join("\n\n")
  const useCounterpart =
    (highlight.contentMode ?? "original") !== contentMode &&
    Boolean(highlight.counterpartContent)
  const activeContent = useCounterpart ? highlight.counterpartContent ?? "" : highlight.content
  const highlightTexts = Array.from(
    new Set([
      activeContent.trim(),
      decodeHtmlEntities(activeContent).trim()
    ].filter(Boolean))
  )
  const range = normalizeRange(
    normalizedContent,
    highlightTexts,
    useCounterpart ? highlight.counterpartParaOffsetStart : highlight.paraOffsetStart,
    useCounterpart ? highlight.counterpartParaOffsetEnd : highlight.paraOffsetEnd
  )
  if (!range) {
    return null
  }

  return {
    sectionIndex,
    paragraphIndex: findParagraphIndex(layouts, range.start),
    start: range.start,
    end: range.end
  }
}

export function buildParagraphSegments(
  text: string,
  paragraphStart: number,
  highlights: HighlightRange[]
): ParagraphSegment[] {
  if (!text) {
    return []
  }

  const ranges = highlights
    .map((item) => ({
      id: item.id,
      color: item.color,
      start: Math.max(0, item.start - paragraphStart),
      end: Math.min(text.length, item.end - paragraphStart)
    }))
    .filter((item) => item.end > item.start)
    .sort((left, right) => left.start - right.start)

  if (!ranges.length) {
    return [{ text, activeHighlightId: null, color: null }]
  }

  const boundaries = new Set<number>([0, text.length])
  ranges.forEach((item) => {
    boundaries.add(item.start)
    boundaries.add(item.end)
  })
  const points = Array.from(boundaries).sort((left, right) => left - right)
  const segments: ParagraphSegment[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    if (end <= start) {
      continue
    }
    const chunk = text.slice(start, end)
    if (!chunk) {
      continue
    }
    const active = ranges.find((item) => start >= item.start && end <= item.end) ?? null
    segments.push({
      text: chunk,
      activeHighlightId: active?.id ?? null,
      color: active?.color ?? null
    })
  }

  return segments
}

function findLayoutByOffset(layouts: ParagraphLayout[], offset: number) {
  return layouts.find((item) => offset >= item.start && offset <= item.end) ?? null
}

function mapRangeToCounterpart(
  sourceContent: string,
  targetContent: string,
  selectedRange: { start: number; end: number }
) {
  const sourceLayouts = buildParagraphLayouts(sourceContent)
  const targetLayouts = buildParagraphLayouts(targetContent)
  const sourceLayout = findLayoutByOffset(sourceLayouts, selectedRange.start)
  if (!sourceLayout) {
    return null
  }
  const targetLayout = targetLayouts[sourceLayout.index]
  if (!targetLayout) {
    return null
  }
  const sourceLength = Math.max(1, sourceLayout.end - sourceLayout.start)
  const targetLength = Math.max(1, targetLayout.end - targetLayout.start)
  const relativeStart = (selectedRange.start - sourceLayout.start) / sourceLength
  const relativeEnd = (selectedRange.end - sourceLayout.start) / sourceLength
  const mappedStart = targetLayout.start + Math.floor(relativeStart * targetLength)
  const mappedEnd = targetLayout.start + Math.ceil(relativeEnd * targetLength)
  const start = Math.max(targetLayout.start, Math.min(mappedStart, targetLayout.end - 1))
  const end = Math.max(start + 1, Math.min(mappedEnd, targetLayout.end))
  return { start, end }
}

export function buildTextHighlightPayload(input: BuildTextHighlightPayloadInput) {
  const targetSection = input.sections[input.selectedSectionIndex] ?? input.fallbackSection
  const counterpartSection = input.counterpartSections?.[input.selectedSectionIndex]
  const counterpartRange = counterpartSection
    ? mapRangeToCounterpart(
        targetSection.content,
        counterpartSection.content,
        input.selectedRange
      )
    : null
  return {
    bookId: input.bookId,
    format: input.format,
    pageIndex: targetSection.pageIndex,
    chapterHref: input.format === "EPUB" ? targetSection.href : undefined,
    contentMode: input.contentMode ?? "original",
    targetLanguage: input.targetLanguage,
    ...(counterpartRange
      ? {
          counterpartContent: counterpartSection?.content.slice(
            counterpartRange.start,
            counterpartRange.end
          ),
          counterpartParaOffsetStart: counterpartRange.start,
          counterpartParaOffsetEnd: counterpartRange.end
        }
      : {}),
    paraOffsetStart: input.selectedRange.start,
    paraOffsetEnd: input.selectedRange.end,
    content: input.selectedText,
    note: input.note,
    color: input.color
  }
}
