import { Readability } from "@mozilla/readability"
import { parseHTML } from "linkedom"
import {
  buildSummaryFromSections,
  extractPublishedAt,
  fetchPage,
  findCoverImage,
  htmlToSections,
  injectImagePlaceholders,
  type ExtractedArticle
} from "@/src/server/services/scout/content-extractor/base"

export async function fetchAndExtractGeneric(url: string): Promise<ExtractedArticle | null> {
  try {
    const html = await fetchPage(url)
    if (!html) {
      return null
    }
    return extractGenericFromHtml(html, url)
  } catch {
    return null
  }
}

export function extractGenericFromHtml(html: string, baseUrl?: string): ExtractedArticle | null {
  try {
    const { document } = parseHTML(html)
    const publishedAt = extractPublishedAt(document as unknown as Document)
    injectImagePlaceholders(document as unknown as Document, baseUrl)
    const reader = new Readability(document as unknown as Document, {
      charThreshold: 100
    })
    const article = reader.parse()
    if (!article?.content) {
      return null
    }

    const sections = htmlToSections(article.content, baseUrl)
    if (sections.length === 0) {
      return null
    }

    return {
      title: article.title ?? "",
      author: article.byline ?? undefined,
      content: sections,
      summary: buildSummaryFromSections(sections, article.excerpt ?? undefined),
      siteName: article.siteName ?? undefined,
      publishedAt,
      coverImage: findCoverImage(sections)
    }
  } catch {
    return null
  }
}
