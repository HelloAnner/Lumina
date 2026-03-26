/**
 * 手动文章链接导入服务
 * 负责 URL 归一化、正文提取、去重与文章入库
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/26
 */
import { randomUUID } from "node:crypto"
import { repository } from "@/src/server/repositories"
import type { ScoutArticle } from "@/src/server/store/types"
import { persistArticleAssets } from "@/src/server/services/articles/assets"
import {
  fetchAndExtract,
  type ExtractedArticle
} from "@/src/server/services/scout/content-extractor"
import { normalizeUrl } from "@/src/server/services/scout/url-utils"

interface ManualImportInput {
  userId: string
  url: string
}

interface ManualImportDeps {
  findArticleBySourceUrl: (userId: string, sourceUrl: string) => ScoutArticle | null | undefined
  createArticle: (input: Omit<ScoutArticle, "id" | "createdAt"> & { id?: string }) => ScoutArticle
  fetchAndExtract: (url: string) => Promise<ExtractedArticle | null>
  createEntryId: () => string
  createArticleId: () => string
  persistArticleAssets: typeof persistArticleAssets
}

export interface ManualImportResult {
  status: "created" | "existing"
  item: ScoutArticle
}

export class ArticleImportError extends Error {
  code: "invalid_url" | "extract_failed"

  constructor(code: "invalid_url" | "extract_failed", message: string) {
    super(message)
    this.code = code
  }
}

const defaultDeps: ManualImportDeps = {
  findArticleBySourceUrl: (userId, sourceUrl) => repository.findArticleBySourceUrl(userId, sourceUrl),
  createArticle: (input) => repository.createArticle(input),
  fetchAndExtract,
  createEntryId: () => `manual-${randomUUID()}`
  ,
  createArticleId: () => randomUUID(),
  persistArticleAssets
}

export async function importArticleFromUrl(
  input: ManualImportInput,
  deps: ManualImportDeps = defaultDeps
): Promise<ManualImportResult> {
  const normalizedUrl = parseImportUrl(input.url)
  const existing = deps.findArticleBySourceUrl(input.userId, normalizedUrl)
  if (existing) {
    return { status: "existing", item: existing }
  }

  const extracted = await deps.fetchAndExtract(normalizedUrl)
  if (!extracted || extracted.content.length === 0) {
    throw new ArticleImportError("extract_failed", "未能解析该链接的正文")
  }

  const articleId = deps.createArticleId()
  const withAssets = await deps.persistArticleAssets({
    userId: input.userId,
    articleId,
    content: extracted.content,
    coverImage: extracted.coverImage
  })
  const item = deps.createArticle(
    buildArticlePayload(
      input.userId,
      normalizedUrl,
      {
        ...extracted,
        content: withAssets.content,
        coverImage: withAssets.coverImage
      },
      deps.createEntryId(),
      articleId
    )
  )
  return { status: "created", item }
}

function parseImportUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  try {
    const url = new URL(trimmed)
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("unsupported")
    }
    return normalizeUrl(url.toString())
  } catch {
    throw new ArticleImportError("invalid_url", "请输入有效的文章链接")
  }
}

function buildArticlePayload(
  userId: string,
  sourceUrl: string,
  extracted: ExtractedArticle,
  entryId: string,
  articleId: string
): Omit<ScoutArticle, "id" | "createdAt"> & { id: string } {
  return {
    id: articleId,
    userId,
    entryId,
    sourceId: "manual",
    title: buildTitle(extracted, sourceUrl),
    author: extracted.author,
    sourceUrl,
    channelName: buildChannelName(extracted, sourceUrl),
    channelIcon: "",
    publishedAt: extracted.publishedAt,
    topics: [],
    summary: extracted.summary.trim(),
    content: extracted.content,
    readProgress: 0,
    highlightCount: 0,
    siteName: extracted.siteName,
    coverImage: extracted.coverImage,
    status: "ready"
  }
}

function buildTitle(extracted: ExtractedArticle, sourceUrl: string): string {
  if (extracted.title.trim()) {
    return extracted.title.trim()
  }
  return new URL(sourceUrl).hostname.replace(/^www\./, "")
}

function buildChannelName(extracted: ExtractedArticle, sourceUrl: string): string {
  if (extracted.siteName?.trim()) {
    return extracted.siteName.trim()
  }
  return new URL(sourceUrl).hostname.replace(/^www\./, "")
}
