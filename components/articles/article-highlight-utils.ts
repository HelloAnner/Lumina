/**
 * 文章高亮定位与偏移计算工具
 * 将 ArticleSection[] 扁平块列表映射为「虚拟内容字符串」，
 * 使书籍阅读器的 buildParagraphSegments 可直接复用
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
import { decodeHtmlEntities } from "@/src/lib/html-entities"
import type {
  ArticleSection,
  Highlight,
  HighlightColor,
  TranslationDisplayMode
} from "@/src/server/store/types"
import type { HighlightAnchor, ParagraphLayout } from "@/components/reader/reader-highlight-utils"

/** 文本块在虚拟内容字符串中的映射 */
export interface ArticleTextBlock {
  blockIndex: number
  text: string
  start: number
  end: number
}

const TEXT_TYPES = new Set(["paragraph", "heading", "blockquote"])

/** 获取块的纯文本内容 */
function blockText(section: ArticleSection): string | null {
  if (TEXT_TYPES.has(section.type) && section.text) {
    return section.text
  }
  if (section.type === "list" && section.items?.length) {
    return section.items.join("\n")
  }
  return null
}

/** 遍历 ArticleSection[]，为每个文本块计算虚拟偏移 */
export function buildArticleTextBlocks(sections: ArticleSection[]): ArticleTextBlock[] {
  const result: ArticleTextBlock[] = []
  let cursor = 0
  for (let i = 0; i < sections.length; i++) {
    const text = blockText(sections[i])
    if (text === null) {
      continue
    }
    const start = cursor
    const end = start + text.length
    result.push({ blockIndex: i, text, start, end })
    cursor = end + 2 // \n\n 分隔
  }
  return result
}

/** 拼接虚拟内容字符串（与 buildArticleTextBlocks 偏移对齐） */
export function buildArticleVirtualContent(sections: ArticleSection[]): string {
  return buildArticleTextBlocks(sections)
    .map((b) => b.text)
    .join("\n\n")
}

/** 将虚拟偏移转换为 ParagraphLayout[] 格式，兼容 buildParagraphSegments */
export function buildArticleParagraphLayouts(sections: ArticleSection[]): ParagraphLayout[] {
  return buildArticleTextBlocks(sections).map((b, idx) => ({
    index: idx,
    text: b.text,
    start: b.start,
    end: b.end
  }))
}

/** 将高亮的 paraOffsetStart/End 解析到文章虚拟内容坐标系 */
export function resolveArticleHighlight(
  sections: ArticleSection[],
  highlight: Pick<Highlight, "content" | "contentMode" | "counterpartContent" | "paraOffsetStart" | "paraOffsetEnd" | "counterpartParaOffsetStart" | "counterpartParaOffsetEnd">,
  contentMode: TranslationDisplayMode = "original"
): HighlightAnchor | null {
  const layouts = buildArticleParagraphLayouts(sections)
  if (!layouts.length) {
    return null
  }
  const virtualContent = layouts.map((l) => l.text).join("\n\n")

  const useCounterpart =
    (highlight.contentMode ?? "original") !== contentMode &&
    Boolean(highlight.counterpartContent)
  const activeContent = useCounterpart
    ? highlight.counterpartContent ?? ""
    : highlight.content
  const start = useCounterpart ? highlight.counterpartParaOffsetStart : highlight.paraOffsetStart
  const end = useCounterpart ? highlight.counterpartParaOffsetEnd : highlight.paraOffsetEnd

  // 优先使用偏移定位
  if (typeof start === "number" && typeof end === "number" && start >= 0 && end > start) {
    if (virtualContent.slice(start, end) === activeContent.trim()) {
      const paragraphIndex = layouts.findIndex((l) => start >= l.start && start < l.end)
      return { sectionIndex: 0, paragraphIndex: Math.max(0, paragraphIndex), start, end }
    }
  }

  // 回退：文本搜索
  const candidates = [
    activeContent.trim(),
    decodeHtmlEntities(activeContent).trim()
  ].filter(Boolean)

  for (const text of candidates) {
    const idx = virtualContent.indexOf(text)
    if (idx >= 0) {
      const paragraphIndex = layouts.findIndex((l) => idx >= l.start && idx < l.end)
      return {
        sectionIndex: 0,
        paragraphIndex: Math.max(0, paragraphIndex),
        start: idx,
        end: idx + text.length
      }
    }
  }

  return null
}

/** 构建文章高亮创建请求体 */
export function buildArticleHighlightPayload(input: {
  articleId: string
  selectedText: string
  selectedRange: { start: number; end: number }
  contentMode?: TranslationDisplayMode
  targetLanguage?: string
  counterpartVirtualContent?: string
  color: HighlightColor
  note?: string
}) {
  let counterpart: {
    counterpartContent?: string
    counterpartParaOffsetStart?: number
    counterpartParaOffsetEnd?: number
  } = {}

  if (input.counterpartVirtualContent) {
    // 简单按比例映射（与书籍阅读器 mapRangeToCounterpart 逻辑对齐）
    const srcLen = input.selectedRange.end - input.selectedRange.start
    if (srcLen > 0) {
      const ratio = input.counterpartVirtualContent.length / Math.max(1, srcLen * 4)
      const approxStart = Math.round(input.selectedRange.start * ratio)
      const approxEnd = Math.round(input.selectedRange.end * ratio)
      const start = Math.max(0, Math.min(approxStart, input.counterpartVirtualContent.length - 1))
      const end = Math.max(start + 1, Math.min(approxEnd, input.counterpartVirtualContent.length))
      counterpart = {
        counterpartContent: input.counterpartVirtualContent.slice(start, end),
        counterpartParaOffsetStart: start,
        counterpartParaOffsetEnd: end
      }
    }
  }

  return {
    bookId: input.articleId,
    format: "EPUB" as const,
    sourceType: "article" as const,
    articleId: input.articleId,
    contentMode: input.contentMode ?? "original",
    targetLanguage: input.targetLanguage,
    ...counterpart,
    paraOffsetStart: input.selectedRange.start,
    paraOffsetEnd: input.selectedRange.end,
    content: input.selectedText,
    note: input.note,
    color: input.color
  }
}
