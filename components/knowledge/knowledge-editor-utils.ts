/**
 * 知识库笔记编辑器工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
const UNORDERED_LIST_PATTERN = /^[-*]\s+(.*)$/
const ORDERED_LIST_PATTERN = /^\d+\.\s+(.*)$/

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

export function renderKnowledgeMarkdown(text: string) {
  if (!text) {
    return '<p class="empty-paragraph"><br></p>'
  }

  const normalized = text.replace(/\r\n?/g, "\n")
  const lines = normalized.split("\n")
  const blocks: string[] = []

  for (let index = 0; index < lines.length;) {
    const line = lines[index]
    const codeBlock = consumeCodeBlock(lines, index)

    if (codeBlock) {
      blocks.push(codeBlock.html)
      index = codeBlock.nextIndex
      continue
    }

    if (!line.trim()) {
      blocks.push('<p class="empty-paragraph"><br></p>')
      index += 1
      continue
    }

    const unorderedList = consumeList(lines, index, "unordered")
    if (unorderedList) {
      blocks.push(unorderedList.html)
      index = unorderedList.nextIndex
      continue
    }

    const orderedList = consumeList(lines, index, "ordered")
    if (orderedList) {
      blocks.push(orderedList.html)
      index = orderedList.nextIndex
      continue
    }

    blocks.push(renderKnowledgeLine(line))
    index += 1
  }

  return blocks.join("")
}

export function buildKnowledgeSaveRequest(
  viewpointId: string | null | undefined,
  articleContent: string,
  persistedContent: string | null | undefined
) {
  if (!viewpointId) {
    return null
  }

  if ((persistedContent ?? "") === articleContent) {
    return null
  }

  return {
    viewpointId,
    articleContent
  }
}

function consumeCodeBlock(lines: string[], startIndex: number) {
  const firstLine = lines[startIndex]
  if (!firstLine.startsWith("```")) {
    return null
  }

  const language = firstLine.slice(3).trim()
  const codeLines: string[] = []
  let index = startIndex + 1

  while (index < lines.length && !lines[index].startsWith("```")) {
    codeLines.push(lines[index])
    index += 1
  }

  if (index < lines.length) {
    index += 1
  }

  return {
    html: `<pre class="code-block" data-lang="${escapeKnowledgeHtml(language)}"><code>${escapeKnowledgeHtml(codeLines.join("\n").trim())}</code></pre>`,
    nextIndex: index
  }
}

function consumeList(lines: string[], startIndex: number, type: "unordered" | "ordered") {
  const pattern = type === "unordered" ? UNORDERED_LIST_PATTERN : ORDERED_LIST_PATTERN
  const wrapperTag = type === "unordered" ? "ul" : "ol"
  const items: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const match = lines[index].match(pattern)
    if (!match) {
      break
    }
    items.push(`<li>${renderKnowledgeInline(match[1])}</li>`)
    index += 1
  }

  if (items.length === 0) {
    return null
  }

  return {
    html: `<${wrapperTag}>${items.join("")}</${wrapperTag}>`,
    nextIndex: index
  }
}

function renderKnowledgeLine(line: string) {
  if (line.startsWith("# ")) {
    return `<h1>${renderKnowledgeInline(line.slice(2))}</h1>`
  }

  if (line.startsWith("## ")) {
    return `<h2>${renderKnowledgeInline(line.slice(3))}</h2>`
  }

  if (line.startsWith("### ")) {
    return `<h3>${renderKnowledgeInline(line.slice(4))}</h3>`
  }

  if (line.startsWith("> ")) {
    return `<blockquote>${renderKnowledgeInline(line.slice(2))}</blockquote>`
  }

  return `<p>${renderKnowledgeInline(line)}</p>`
}

function renderKnowledgeInline(line: string) {
  return escapeKnowledgeHtml(line)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
}

function escapeKnowledgeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
