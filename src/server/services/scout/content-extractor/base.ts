import { parseFragment, type DefaultTreeAdapterTypes } from "parse5"
import { decodeHtmlEntities } from "@/src/lib/html-entities"
import type { ArticleSection } from "@/src/server/store/types"

export interface ExtractedArticle {
  title: string
  author?: string
  content: ArticleSection[]
  summary: string
  siteName?: string
  publishedAt?: string
  coverImage?: string
}

const SKIP_TAGS = new Set(["script", "style", "noscript", "svg", "nav", "footer"])
const HEADING_TAGS = new Set(["h1", "h2", "h3"])
const IMAGE_PLACEHOLDER_PREFIX = "[[LUMINA_IMAGE:"
const IMAGE_PLACEHOLDER_SUFFIX = "]]"

export async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Lumina-Scout/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "follow"
    })

    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.includes("html") && !contentType.includes("xml")) {
      return null
    }

    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

export function buildSummaryFromSections(
  sections: ArticleSection[],
  preferredSummary?: string,
  maxLength = 300
) {
  const fallbackText = sections
    .filter((section) => section.type === "paragraph" || section.type === "heading")
    .map((section) => section.text ?? "")
    .join(" ")
  const summary = (preferredSummary ?? fallbackText.slice(0, 200)).trim()
  return summary.slice(0, maxLength)
}

export function findCoverImage(sections: ArticleSection[]) {
  return sections.find((section) => section.type === "image")?.src
}

export function extractPublishedAt(document: Document) {
  const candidates = [
    readMetaPublishedAt(document),
    readJsonLdPublishedAt(document),
    readTimePublishedAt(document)
  ]
  for (const candidate of candidates) {
    const normalized = normalizePublishedAt(candidate)
    if (normalized) {
      return normalized
    }
  }
  return undefined
}

export function injectImagePlaceholders(document: Document, baseUrl?: string) {
  const images = Array.from(document.querySelectorAll("img"))
  images.forEach((imageNode) => {
    const src = pickImageSourceFromElement(imageNode, baseUrl)
    if (!src) {
      imageNode.remove()
      return
    }
    const placeholderNode = document.createElement("p")
    placeholderNode.textContent = buildImagePlaceholder(src, getNodeAttribute(imageNode, "alt"))
    imageNode.replaceWith(placeholderNode)
  })
}

export function htmlToSections(html: string, baseUrl?: string): ArticleSection[] {
  const fragment = parseFragment(html)
  const sections: ArticleSection[] = []
  let sectionIndex = 0

  walkNodes(fragment.childNodes, sections, baseUrl, () => `s-${++sectionIndex}`)
  return sections.filter((section) => {
    if (section.type === "paragraph" || section.type === "heading" || section.type === "blockquote") {
      return typeof section.text === "string" && section.text.trim().length > 0
    }
    if (section.type === "image") {
      return typeof section.src === "string" && section.src.length > 0
    }
    if (section.type === "list") {
      return Array.isArray(section.items) && section.items.length > 0
    }
    if (section.type === "code") {
      return typeof section.text === "string" && section.text.trim().length > 0
    }
    return false
  })
}

export function collapseWhitespace(text: string) {
  return text.replace(/[ \t\f\v]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

export function resolveUrl(src: string, baseUrl?: string): string {
  if (!src || src.startsWith("data:")) {
    return src
  }
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src
  }
  if (!baseUrl) {
    return src
  }
  try {
    return new URL(src, baseUrl).href
  } catch {
    return src
  }
}

function isElement(node: DefaultTreeAdapterTypes.ChildNode): node is DefaultTreeAdapterTypes.Element {
  return "tagName" in node
}

function isTextNode(node: DefaultTreeAdapterTypes.ChildNode): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === "#text"
}

function getAttr(el: DefaultTreeAdapterTypes.Element, name: string): string | undefined {
  return el.attrs.find((attr) => attr.name === name)?.value?.trim()
}

function getNodeAttribute(node: Element, name: string) {
  const value = node.getAttribute(name)
  return value?.trim() || undefined
}

function pickLargestSrcFromSrcset(srcset?: string) {
  if (!srcset) {
    return ""
  }
  const candidates = srcset
    .split(",")
    .map((item) => item.trim())
    .map((item) => {
      const [url, descriptor] = item.split(/\s+/, 2)
      const width = descriptor?.endsWith("w") ? Number(descriptor.slice(0, -1)) : 0
      return {
        url,
        width: Number.isFinite(width) ? width : 0
      }
    })
    .filter((item) => Boolean(item.url))
    .sort((left, right) => right.width - left.width)
  return candidates[0]?.url ?? ""
}

function pickImageSourceFromElement(node: Element, baseUrl?: string) {
  const directSrc =
    getNodeAttribute(node, "src") ||
    getNodeAttribute(node, "data-src") ||
    getNodeAttribute(node, "data-original") ||
    getNodeAttribute(node, "data-lazy-src")
  const srcsetSrc = pickLargestSrcFromSrcset(
    getNodeAttribute(node, "srcset") ||
      getNodeAttribute(node, "data-srcset") ||
      getNodeAttribute(node, "data-lazy-srcset")
  )
  const chosenSrc = srcsetSrc || directSrc || ""
  return chosenSrc ? resolveUrl(chosenSrc, baseUrl) : ""
}

function buildImagePlaceholder(src: string, alt?: string) {
  return `${IMAGE_PLACEHOLDER_PREFIX}${encodeURIComponent(
    JSON.stringify({ src, alt: alt ?? "" })
  )}${IMAGE_PLACEHOLDER_SUFFIX}`
}

function parseImagePlaceholder(text: string) {
  const trimmed = text.trim()
  if (!trimmed.startsWith(IMAGE_PLACEHOLDER_PREFIX) || !trimmed.endsWith(IMAGE_PLACEHOLDER_SUFFIX)) {
    return null
  }
  try {
    return JSON.parse(
      decodeURIComponent(
        trimmed.slice(IMAGE_PLACEHOLDER_PREFIX.length, -IMAGE_PLACEHOLDER_SUFFIX.length)
      )
    ) as { src: string; alt?: string }
  } catch {
    return null
  }
}

function readMetaPublishedAt(document: Document) {
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[property="og:published_time"]',
    'meta[name="og:published_time"]',
    'meta[name="pubdate"]',
    'meta[name="publish-date"]',
    'meta[name="publish_date"]',
    'meta[name="date"]',
    'meta[itemprop="datePublished"]'
  ]
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute("content")?.trim()
    if (value) {
      return value
    }
  }
  return undefined
}

function readJsonLdPublishedAt(document: Document) {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
  for (const script of scripts) {
    const value = extractJsonLdPublishedAt(script.textContent ?? "")
    if (value) {
      return value
    }
  }
  return undefined
}

function extractJsonLdPublishedAt(rawText: string): string | undefined {
  try {
    return findStructuredDate(JSON.parse(rawText) as unknown)
  } catch {
    return undefined
  }
}

function findStructuredDate(payload: unknown): string | undefined {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const value = findStructuredDate(item)
      if (value) {
        return value
      }
    }
    return undefined
  }
  if (!payload || typeof payload !== "object") {
    return undefined
  }
  const record = payload as Record<string, unknown>
  for (const key of ["datePublished", "dateCreated", "uploadDate"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return record["@graph"] ? findStructuredDate(record["@graph"]) : undefined
}

function readTimePublishedAt(document: Document) {
  const value = document.querySelector("time[datetime]")?.getAttribute("datetime")?.trim()
  return value || undefined
}

function normalizePublishedAt(rawValue?: string) {
  if (!rawValue) {
    return undefined
  }
  const timestamp = Date.parse(rawValue)
  if (Number.isNaN(timestamp)) {
    return undefined
  }
  return new Date(timestamp).toISOString()
}

function collectInlineText(node: DefaultTreeAdapterTypes.ChildNode): string {
  if (isTextNode(node)) {
    return decodeHtmlEntities(node.value).replace(/\u00a0/g, " ")
  }
  if (!isElement(node)) {
    return ""
  }
  const tag = node.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag)) {
    return ""
  }
  if (tag === "br") {
    return "\n"
  }
  if (tag === "img") {
    return getAttr(node, "alt") ?? ""
  }
  return node.childNodes.map(collectInlineText).join("")
}

function walkNodes(
  nodes: DefaultTreeAdapterTypes.ChildNode[],
  sections: ArticleSection[],
  baseUrl: string | undefined,
  nextId: () => string
) {
  const inlineBuffer: string[] = []

  const flushInline = () => {
    const merged = collapseWhitespace(inlineBuffer.join(" "))
    if (merged) {
      const image = parseImagePlaceholder(merged)
      if (image?.src) {
        sections.push({ id: nextId(), type: "image", src: image.src, alt: image.alt })
      } else {
        sections.push({ id: nextId(), type: "paragraph", text: merged })
      }
    }
    inlineBuffer.length = 0
  }

  for (const node of nodes) {
    if (isTextNode(node)) {
      const text = decodeHtmlEntities(node.value).replace(/\u00a0/g, " ")
      if (text.trim()) {
        inlineBuffer.push(text)
      }
      continue
    }

    if (!isElement(node)) {
      continue
    }

    const tag = node.tagName.toLowerCase()

    if (SKIP_TAGS.has(tag)) {
      continue
    }

    if (HEADING_TAGS.has(tag)) {
      flushInline()
      const text = collapseWhitespace(collectInlineText(node))
      if (text) {
        const level = (Number(tag[1]) <= 3 ? Number(tag[1]) : 3) as 1 | 2 | 3
        sections.push({ id: nextId(), type: "heading", level, text })
      }
      continue
    }

    if (tag === "img") {
      const src = getAttr(node, "src")
      if (src) {
        flushInline()
        sections.push({
          id: nextId(),
          type: "image",
          src: resolveUrl(src, baseUrl),
          alt: getAttr(node, "alt")
        })
      }
      continue
    }

    if (tag === "figure") {
      flushInline()
      walkNodes(node.childNodes, sections, baseUrl, nextId)
      continue
    }

    if (tag === "pre") {
      flushInline()
      const codeElement = node.childNodes.find(
        (child) => isElement(child) && child.tagName.toLowerCase() === "code"
      ) as DefaultTreeAdapterTypes.Element | undefined
      const text = collectInlineText(codeElement ?? node)
      if (text.trim()) {
        const language = codeElement ? getAttr(codeElement, "class")?.replace(/^language-/, "") : undefined
        sections.push({ id: nextId(), type: "code", text: text.trim(), language })
      }
      continue
    }

    if (tag === "blockquote") {
      flushInline()
      const text = collapseWhitespace(collectInlineText(node))
      if (text) {
        sections.push({ id: nextId(), type: "blockquote", text })
      }
      continue
    }

    if (tag === "ul" || tag === "ol") {
      flushInline()
      const items = node.childNodes
        .filter((child) => isElement(child) && child.tagName.toLowerCase() === "li")
        .map((item) => collapseWhitespace(collectInlineText(item)))
        .filter(Boolean)
      if (items.length > 0) {
        sections.push({ id: nextId(), type: "list", items })
      }
      continue
    }

    if (tag === "p") {
      flushInline()
      const hasBlockChild = node.childNodes.some(
        (child) =>
          isElement(child) &&
          (child.tagName.toLowerCase() === "img" || child.tagName.toLowerCase() === "figure")
      )
      if (hasBlockChild) {
        walkNodes(node.childNodes, sections, baseUrl, nextId)
      } else {
        const text = collapseWhitespace(collectInlineText(node))
        if (text) {
          const image = parseImagePlaceholder(text)
          if (image?.src) {
            sections.push({ id: nextId(), type: "image", src: image.src, alt: image.alt })
          } else {
            sections.push({ id: nextId(), type: "paragraph", text })
          }
        }
      }
      continue
    }

    if (tag === "div" || tag === "section" || tag === "article" || tag === "main" || tag === "aside") {
      flushInline()
      walkNodes(node.childNodes, sections, baseUrl, nextId)
      continue
    }

    const text = collectInlineText(node)
    if (text.trim()) {
      inlineBuffer.push(text)
    }
  }

  flushInline()
}
