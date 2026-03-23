/**
 * 书籍正文规整工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import { parseFragment, type DefaultTreeAdapterTypes } from "parse5"
import { decodeHtmlEntities } from "@/src/lib/html-entities"

const SKIP_TAGS = new Set(["script", "style", "noscript"])
const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "caption",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "li",
  "main",
  "nav",
  "p",
  "pre",
  "section",
  "td",
  "th"
])

function collapseInlineSpaces(value: string) {
  return value.replace(/[ \t\f\v]+/g, " ").trim()
}

function normalizeTextNode(value: string, preserveWhitespace: boolean) {
  const decoded = decodeHtmlEntities(value).replace(/\u00a0/g, " ")
  if (preserveWhitespace) {
    return decoded.replace(/\r\n?/g, "\n")
  }
  return decoded.replace(/\s+/g, " ")
}

function isElement(
  node: DefaultTreeAdapterTypes.ChildNode
): node is DefaultTreeAdapterTypes.Element {
  return "tagName" in node
}

function isTextNode(
  node: DefaultTreeAdapterTypes.ChildNode
): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === "#text"
}

function getTagName(node: DefaultTreeAdapterTypes.ChildNode) {
  return isElement(node) ? node.tagName.toLowerCase() : ""
}

function splitDenseParagraph(paragraph: string) {
  const compact = collapseInlineSpaces(paragraph)
  if (!compact || compact.length < 30) {
    return compact ? [compact] : []
  }

  const sentences =
    compact.match(/[^。！？!?；;]+[。！？!?；;]?/g)?.map((item) => item.trim()).filter(Boolean) ??
    []
  if (sentences.length < 4) {
    return [compact]
  }

  const chunks: string[] = []
  let buffer = ""
  let sentenceCount = 0
  sentences.forEach((sentence) => {
    buffer += sentence
    sentenceCount += 1
    if ((buffer.length >= 32 && sentenceCount >= 2) || buffer.length >= 60) {
      chunks.push(buffer)
      buffer = ""
      sentenceCount = 0
    }
  })
  if (buffer) {
    chunks.push(buffer)
  }
  return chunks.length > 1 ? chunks : [compact]
}

function normalizeBlock(block: string) {
  const normalized = block
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => collapseInlineSpaces(line))
    .filter(Boolean)

  if (normalized.length === 0) {
    return []
  }
  if (normalized.length > 1) {
    return [normalized.join("\n")]
  }
  return splitDenseParagraph(normalized[0])
}

function collectInlineText(
  node: DefaultTreeAdapterTypes.ChildNode,
  preserveWhitespace = false
): string {
  if (isTextNode(node)) {
    return normalizeTextNode(node.value, preserveWhitespace)
  }
  if (!isElement(node)) {
    return ""
  }

  const tagName = node.tagName.toLowerCase()
  if (SKIP_TAGS.has(tagName)) {
    return ""
  }
  if (tagName === "br") {
    return "\n"
  }
  if (tagName === "img") {
    const alt = node.attrs.find((item) => item.name === "alt")?.value ?? ""
    return alt ? ` ${decodeHtmlEntities(alt)} ` : ""
  }

  const nextPreserve = preserveWhitespace || tagName === "pre"
  return node.childNodes.map((child) => collectInlineText(child, nextPreserve)).join("")
}

function flushInlineBuffer(buffer: string[], blocks: string[]) {
  const merged = collapseInlineSpaces(buffer.join(" "))
  if (!merged) {
    buffer.length = 0
    return
  }
  normalizeBlock(merged).forEach((item) => blocks.push(item))
  buffer.length = 0
}

function walkNodes(
  nodes: DefaultTreeAdapterTypes.ChildNode[],
  blocks: string[],
  inlineBuffer: string[]
) {
  nodes.forEach((node) => {
    if (isTextNode(node)) {
      const text = normalizeTextNode(node.value, false)
      if (text.trim()) {
        inlineBuffer.push(text)
      }
      return
    }

    if (!isElement(node)) {
      return
    }

    const tagName = node.tagName.toLowerCase()
    if (SKIP_TAGS.has(tagName)) {
      return
    }

    if (tagName === "br") {
      inlineBuffer.push("\n")
      return
    }

    if (tagName === "ul" || tagName === "ol") {
      flushInlineBuffer(inlineBuffer, blocks)
      const listItems = node.childNodes
        .filter(isElement)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child, index) => {
          const marker = tagName === "ol" ? `${index + 1}. ` : ""
          const text = collectInlineText(child).replace(/\n+/g, " ").trim()
          return text ? `${marker}${text}` : ""
        })
        .filter(Boolean)
      if (listItems.length > 0) {
        blocks.push(listItems.join("\n"))
      }
      return
    }

    if (BLOCK_TAGS.has(tagName)) {
      flushInlineBuffer(inlineBuffer, blocks)
      const text = collectInlineText(node, tagName === "pre")
      normalizeBlock(text).forEach((item) => blocks.push(item))
      return
    }

    const text = collectInlineText(node)
    if (text.trim()) {
      inlineBuffer.push(text)
    }
  })
}

export function normalizeStoredSectionContent(content: string) {
  const normalized = decodeHtmlEntities(content)
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")

  const blocks = normalized
    .split(/\n{2,}/)
    .flatMap((block) => normalizeBlock(block))

  return blocks.join("\n\n").trim()
}

export function extractReadableTextFromHtml(html: string) {
  const fragment = parseFragment(html)
  const blocks: string[] = []
  const inlineBuffer: string[] = []
  walkNodes(fragment.childNodes, blocks, inlineBuffer)
  flushInlineBuffer(inlineBuffer, blocks)
  return blocks.join("\n\n").trim()
}
