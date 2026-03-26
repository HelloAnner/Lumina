/**
 * 正文提取引擎
 * 从 URL 抓取网页 → Readability 提取正文 → 转为结构化 ArticleSection[]
 * 通用引擎，供所有信息源复用
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
import { Readability } from "@mozilla/readability"
import { parseHTML } from "linkedom"
import { parseFragment, type DefaultTreeAdapterTypes } from "parse5"
import { decodeHtmlEntities } from "@/src/lib/html-entities"
import type { ArticleSection } from "@/src/server/store/types"

/** 提取结果 */
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

/** 抓取 URL 并提取正文，失败返回 null */
export async function fetchAndExtract(url: string): Promise<ExtractedArticle | null> {
  try {
    const html = await fetchPage(url)
    if (!html) {
      return null
    }
    return extractFromHtml(html, url)
  } catch {
    return null
  }
}

/** 从已有 HTML 提取正文（供非 URL 场景复用） */
export function extractFromHtml(html: string, baseUrl?: string): ExtractedArticle | null {
  try {
    const { document } = parseHTML(html)
    const publishedAt = extractPublishedAt(document as unknown as Document)
    injectImagePlaceholders(document as unknown as Document, baseUrl)
    const reader = new Readability(document as unknown as Document, {
      charThreshold: 100
    })
    const article = reader.parse()
    if (!article || !article.content) {
      return null
    }

    const sections = htmlToSections(article.content, baseUrl)
    if (sections.length === 0) {
      return null
    }

    const coverImage = sections.find((s) => s.type === "image")?.src
    const textContent = sections
      .filter((s) => s.type === "paragraph" || s.type === "heading")
      .map((s) => s.text ?? "")
      .join(" ")

    return {
      title: article.title ?? "",
      author: article.byline ?? undefined,
      content: sections,
      summary: (article.excerpt ?? textContent.slice(0, 200)).slice(0, 300),
      siteName: article.siteName ?? undefined,
      publishedAt,
      coverImage
    }
  } catch {
    return null
  }
}

/**
 * 将 HTML 转为结构化 ArticleSection[]
 * 独立函数，可被其他适配器复用
 */
export function htmlToSections(html: string, baseUrl?: string): ArticleSection[] {
  const fragment = parseFragment(html)
  const sections: ArticleSection[] = []
  let sectionIndex = 0

  walkNodes(fragment.childNodes, sections, baseUrl, () => `s-${++sectionIndex}`)
  return sections.filter((s) => {
    if (s.type === "paragraph" || s.type === "heading" || s.type === "blockquote") {
      return s.text && s.text.trim().length > 0
    }
    if (s.type === "image") {
      return !!s.src
    }
    if (s.type === "list") {
      return s.items && s.items.length > 0
    }
    if (s.type === "code") {
      return s.text && s.text.trim().length > 0
    }
    return false
  })
}

// ─── 内部实现 ───

async function fetchPage(url: string): Promise<string | null> {
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

function isElement(node: DefaultTreeAdapterTypes.ChildNode): node is DefaultTreeAdapterTypes.Element {
  return "tagName" in node
}

function isTextNode(node: DefaultTreeAdapterTypes.ChildNode): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === "#text"
}

function getAttr(el: DefaultTreeAdapterTypes.Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value?.trim()
}

function getNodeAttribute(node: Element, name: string) {
  const value = node.getAttribute(name)
  return value?.trim() || undefined
}

/** 解析相对 URL 为绝对 URL */
function resolveUrl(src: string, baseUrl?: string): string {
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

function injectImagePlaceholders(document: Document, baseUrl?: string) {
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

function extractPublishedAt(document: Document) {
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

/** 收集元素内所有行内文本 */
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

function collapseWhitespace(text: string): string {
  return text.replace(/[ \t\f\v]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
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

    // 标题
    if (HEADING_TAGS.has(tag)) {
      flushInline()
      const text = collapseWhitespace(collectInlineText(node))
      if (text) {
        const level = (Number(tag[1]) <= 3 ? Number(tag[1]) : 3) as 1 | 2 | 3
        sections.push({ id: nextId(), type: "heading", level, text })
      }
      continue
    }

    // 图片
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

    // figure — 内含 img + figcaption
    if (tag === "figure") {
      flushInline()
      walkNodes(node.childNodes, sections, baseUrl, nextId)
      continue
    }

    // 代码块
    if (tag === "pre") {
      flushInline()
      const codeEl = node.childNodes.find(
        (c) => isElement(c) && c.tagName.toLowerCase() === "code"
      ) as DefaultTreeAdapterTypes.Element | undefined
      const text = collectInlineText(codeEl ?? node)
      if (text.trim()) {
        const language = codeEl ? getAttr(codeEl, "class")?.replace(/^language-/, "") : undefined
        sections.push({ id: nextId(), type: "code", text: text.trim(), language })
      }
      continue
    }

    // 引用块
    if (tag === "blockquote") {
      flushInline()
      const text = collapseWhitespace(collectInlineText(node))
      if (text) {
        sections.push({ id: nextId(), type: "blockquote", text })
      }
      continue
    }

    // 列表
    if (tag === "ul" || tag === "ol") {
      flushInline()
      const items = node.childNodes
        .filter((c) => isElement(c) && c.tagName.toLowerCase() === "li")
        .map((li) => collapseWhitespace(collectInlineText(li)))
        .filter(Boolean)
      if (items.length > 0) {
        sections.push({ id: nextId(), type: "list", items })
      }
      continue
    }

    // 段落
    if (tag === "p") {
      flushInline()
      // 段落内可能含图片，需递归
      const hasBlockChild = node.childNodes.some(
        (c) => isElement(c) && (c.tagName.toLowerCase() === "img" || c.tagName.toLowerCase() === "figure")
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

    // div/section/article — 递归
    if (tag === "div" || tag === "section" || tag === "article" || tag === "main" || tag === "aside") {
      flushInline()
      walkNodes(node.childNodes, sections, baseUrl, nextId)
      continue
    }

    // 其他行内元素 — 收集文本
    const text = collectInlineText(node)
    if (text.trim()) {
      inlineBuffer.push(text)
    }
  }

  flushInline()
}
