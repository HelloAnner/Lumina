/**
 * 书籍正文规整工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import { parseFragment, type DefaultTreeAdapterTypes } from "parse5"
import { decodeHtmlEntities } from "@/src/lib/html-entities"
import type { ReaderSectionBlock } from "@/src/server/store/types"

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
const METADATA_FIELD_PATTERN =
  /(书名：|作者：|出版社：|ISBN：|定价：|译者：|责任编辑：|出版时间：|版权所有(?:·侵权必究)?)/g

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
  if (!compact) {
    return []
  }

  const metadataBlocks = splitMetadataParagraph(compact)
  if (metadataBlocks.length > 1) {
    return metadataBlocks
  }

  const headingBlocks = splitHeadingParagraph(compact)
  if (headingBlocks.length > 1) {
    return headingBlocks
  }

  return [compact]
}

function splitMetadataParagraph(paragraph: string) {
  const matches = paragraph.match(METADATA_FIELD_PATTERN) ?? []
  if (matches.length < 3 && !paragraph.startsWith("版权信息 ")) {
    return [paragraph]
  }

  const normalized = paragraph
    .replace(/^版权信息\s+/, "版权信息\n\n")
    .replace(/\s+(?=书名：|作者：|出版社：|ISBN：|定价：|译者：|责任编辑：|出版时间：|版权所有(?:·侵权必究)?)/g, "\n\n")

  const blocks = normalized
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)

  return blocks.length > 1 ? blocks : [paragraph]
}

function splitHeadingParagraph(paragraph: string) {
  const matched = paragraph.match(
    /^(第[0-9一二三四五六七八九十零百]+章(?:\s+[^\s。！？!?]{1,30})?|[0-9]+(?:\.[0-9]+)+\s*[^\s。！？!?]{1,40}|(?:版权信息|专家力荐|推荐序|再版序|自序|后记|尾声[^\s。！？!?]{0,20}|附录[^\s。！？!?]{0,30}))\s+(.+)$/
  )
  if (!matched) {
    return [paragraph]
  }

  const heading = matched[1].trim()
  const body = matched[2].trim()
  if (!body || body.length < 20) {
    return [paragraph]
  }

  return [heading, body]
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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

function parsePositiveNumber(value?: string) {
  if (!value) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }
  return parsed
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

function flushStructuredInlineBuffer(
  buffer: string[],
  blocks: ReaderSectionBlock[]
) {
  const merged = collapseInlineSpaces(buffer.join(" "))
  if (!merged) {
    buffer.length = 0
    return
  }
  normalizeBlock(merged).forEach((item) => {
    blocks.push({
      type: "paragraph",
      text: item
    })
  })
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

function walkStructuredNodes(
  nodes: DefaultTreeAdapterTypes.ChildNode[],
  blocks: ReaderSectionBlock[],
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

    if (tagName === "img") {
      const src = node.attrs.find((item) => item.name === "src")?.value?.trim()
      if (!src) {
        return
      }
      flushStructuredInlineBuffer(inlineBuffer, blocks)
      const alt = node.attrs.find((item) => item.name === "alt")?.value?.trim()
      const width = parsePositiveNumber(node.attrs.find((item) => item.name === "width")?.value)
      const height = parsePositiveNumber(node.attrs.find((item) => item.name === "height")?.value)
      blocks.push({
        type: "image",
        src,
        alt: alt ? decodeHtmlEntities(alt) : undefined,
        ...(typeof width === "number" ? { width } : {}),
        ...(typeof height === "number" ? { height } : {})
      })
      return
    }

    if (tagName === "ul" || tagName === "ol") {
      flushStructuredInlineBuffer(inlineBuffer, blocks)
      const listItems = node.childNodes
        .filter(isElement)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child, index) => {
          const marker = tagName === "ol" ? `${index + 1}. ` : ""
          const text = collectInlineText(child).replace(/\n+/g, " ").trim()
          return text ? `${marker}${text}` : ""
        })
        .filter(Boolean)
      listItems.forEach((item) => {
        blocks.push({
          type: "paragraph",
          text: item
        })
      })
      return
    }

    if (BLOCK_TAGS.has(tagName)) {
      flushStructuredInlineBuffer(inlineBuffer, blocks)
      const nestedBuffer: string[] = []
      walkStructuredNodes(node.childNodes, blocks, nestedBuffer)
      flushStructuredInlineBuffer(nestedBuffer, blocks)
      return
    }

    walkStructuredNodes(node.childNodes, blocks, inlineBuffer)
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

export function buildFallbackParagraphBlocksFromContent(content: string): ReaderSectionBlock[] {
  return normalizeStoredSectionContent(content)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((text) => ({
      type: "paragraph" as const,
      text
    }))
}

export function stripSectionTitlePrefixFromContent(content: string, title: string) {
  if (!content || !title) {
    return content
  }

  const pattern = new RegExp(`^(?:未知\\s+)?${escapeRegex(title)}(?:\\s+|[:：])?`)
  const stripped = content.replace(pattern, "").trim()
  return stripped || content
}

export function extractReadableTextFromHtml(html: string) {
  const fragment = parseFragment(html)
  const blocks: string[] = []
  const inlineBuffer: string[] = []
  walkNodes(fragment.childNodes, blocks, inlineBuffer)
  flushInlineBuffer(inlineBuffer, blocks)
  return blocks.join("\n\n").trim()
}

export function extractStructuredContentFromHtml(html: string) {
  const fragment = parseFragment(html)
  const blocks: ReaderSectionBlock[] = []
  const inlineBuffer: string[] = []
  walkStructuredNodes(fragment.childNodes, blocks, inlineBuffer)
  flushStructuredInlineBuffer(inlineBuffer, blocks)

  return {
    content: blocks
      .filter((item): item is Extract<ReaderSectionBlock, { type: "paragraph" }> => item.type === "paragraph")
      .map((item) => item.text)
      .join("\n\n")
      .trim(),
    blocks
  }
}
