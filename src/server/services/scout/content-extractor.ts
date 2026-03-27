/**
 * 正文提取引擎
 * 按 URL 选择子解析器，默认走通用解析器，X 状态页走专用解析器
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
import { htmlToSections, type ExtractedArticle } from "@/src/server/services/scout/content-extractor/base"
import { fetchAndExtractGeneric, extractGenericFromHtml } from "@/src/server/services/scout/content-extractor/generic"
import { matchContentExtractor } from "@/src/server/services/scout/content-extractor/router"
import {
  fetchAndExtractX,
  extractFromXTweetPayload,
  extractFromXGraphqlTweetResult
} from "@/src/server/services/scout/content-extractor/x"

export {
  type ExtractedArticle,
  htmlToSections,
  matchContentExtractor,
  extractFromXTweetPayload,
  extractFromXGraphqlTweetResult
}

export async function fetchAndExtract(url: string): Promise<ExtractedArticle | null> {
  const match = matchContentExtractor(url)

  if (match.key === "x") {
    const extracted = await fetchAndExtractX(url)
    if (extracted) {
      return extracted
    }
  }

  return fetchAndExtractGeneric(url)
}

export function extractFromHtml(html: string, baseUrl?: string): ExtractedArticle | null {
  return extractGenericFromHtml(html, baseUrl)
}
