/**
 * RSS/Atom 适配器
 * 解析 RSS 2.0、Atom 1.0 feed，返回标准化条目
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
import { XMLParser } from "fast-xml-parser"

interface FeedItem {
  url: string
  title: string
  content: string
  author?: string
  publishedAt?: string
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
})

/** 抓取并解析 RSS/Atom feed */
export async function fetchRss(feedUrl: string): Promise<FeedItem[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Lumina-Scout/1.0" }
    })

    if (!response.ok) {
      throw new Error(`Feed fetch failed: ${response.status}`)
    }

    const xml = await response.text()
    const parsed = parser.parse(xml)

    // RSS 2.0
    if (parsed.rss?.channel?.item) {
      const items = Array.isArray(parsed.rss.channel.item)
        ? parsed.rss.channel.item
        : [parsed.rss.channel.item]
      return items.map(parseRssItem)
    }

    // Atom 1.0
    if (parsed.feed?.entry) {
      const entries = Array.isArray(parsed.feed.entry)
        ? parsed.feed.entry
        : [parsed.feed.entry]
      return entries.map(parseAtomEntry)
    }

    return []
  } finally {
    clearTimeout(timeout)
  }
}

function parseRssItem(item: Record<string, any>): FeedItem {
  const description = item["content:encoded"] ?? item.description ?? ""
  return {
    url: extractArticleUrl(item, description),
    title: item.title ?? "",
    content: description,
    author: item["dc:creator"] ?? item.author ?? undefined,
    publishedAt: item.pubDate ?? undefined
  }
}

/**
 * 从 RSS item 中提取真实文章 URL
 * 聚合站（HN、Lobsters 等）的 <link> 指向讨论页，真实 URL 在描述中
 */
function extractArticleUrl(item: Record<string, any>, description: string): string {
  const link = item.link ?? ""

  // 非聚合站直接返回
  if (!isAggregatorUrl(link)) {
    return link
  }

  // 尝试从描述 HTML 中提取第一个外链
  const match = description.match(/<a\s[^>]*href=["']([^"']+)["'][^>]*>/i)
  if (match?.[1] && !isAggregatorUrl(match[1])) {
    return match[1]
  }

  return link
}

const AGGREGATOR_HOSTS = ["news.ycombinator.com", "lobste.rs", "old.reddit.com", "www.reddit.com"]

function isAggregatorUrl(url: string): boolean {
  try {
    return AGGREGATOR_HOSTS.includes(new URL(url).hostname)
  } catch {
    return false
  }
}

function parseAtomEntry(entry: Record<string, any>): FeedItem {
  const link = Array.isArray(entry.link)
    ? entry.link.find((l: any) => l["@_rel"] === "alternate")?.["@_href"] ?? entry.link[0]?.["@_href"]
    : entry.link?.["@_href"] ?? entry.link

  return {
    url: link ?? "",
    title: typeof entry.title === "string" ? entry.title : entry.title?.["#text"] ?? "",
    content: entry.content?.["#text"] ?? entry.summary?.["#text"] ?? entry.summary ?? "",
    author: entry.author?.name ?? undefined,
    publishedAt: entry.published ?? entry.updated ?? undefined
  }
}
