/**
 * 知识库笔记编辑器工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
export function buildKnowledgeEditorStats(text: string) {
  const normalized = text.replace(/\r\n?/g, "\n")
  const lines = normalized ? normalized.split("\n").length : 1
  const characters = normalized.length
  const words = normalized
    .trim()
    .split(/[\s\u3000]+/)
    .filter(Boolean).length

  return {
    lines,
    characters,
    words
  }
}

export function applyInlineMarkdown(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string,
  fallback: string
) {
  const selected = text.slice(selectionStart, selectionEnd)
  const core = selected || fallback
  const inserted = `${prefix}${core}${suffix}`
  const nextText = text.slice(0, selectionStart) + inserted + text.slice(selectionEnd)

  return {
    text: nextText,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionStart + prefix.length + core.length
  }
}

export function applyLinePrefixMarkdown(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  fallback: string
) {
  const selected = text.slice(selectionStart, selectionEnd) || fallback
  const transformed = selected
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n")

  return {
    text: text.slice(0, selectionStart) + transformed + text.slice(selectionEnd),
    selectionStart,
    selectionEnd: selectionStart + transformed.length
  }
}

export function mapScrollTopByRatio({
  sourceScrollTop,
  sourceScrollHeight,
  sourceClientHeight,
  targetScrollHeight,
  targetClientHeight
}: {
  sourceScrollTop: number
  sourceScrollHeight: number
  sourceClientHeight: number
  targetScrollHeight: number
  targetClientHeight: number
}) {
  const sourceMax = Math.max(1, sourceScrollHeight - sourceClientHeight)
  const targetMax = Math.max(0, targetScrollHeight - targetClientHeight)
  return (sourceScrollTop / sourceMax) * targetMax
}
