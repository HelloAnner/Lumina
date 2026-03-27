import { execFile } from "node:child_process"
import { promisify } from "node:util"
import {
  buildSummaryFromSections,
  collapseWhitespace,
  findCoverImage,
  type ExtractedArticle
} from "@/src/server/services/scout/content-extractor/base"

const execFileAsync = promisify(execFile)
const X_GRAPHQL_BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
const X_TWEET_RESULT_QUERY_ID = "sBoAB5nqJTOyR9sZ5qVLsw"

interface XTweetUrlEntity {
  url?: string
  expanded_url?: string
}

interface XTweetArticle {
  title?: string
  preview_text?: string
  cover_media?: {
    media_info?: {
      original_img_url?: string
    }
  }
}

interface XTweetUser {
  name?: string
  screen_name?: string
}

interface XTweetPayload {
  id_str?: string
  created_at?: string
  full_text?: string
  text?: string
  display_text_range?: [number, number]
  entities?: {
    urls?: XTweetUrlEntity[]
    media?: Array<Record<string, unknown>>
  }
  extended_entities?: {
    media?: Array<Record<string, unknown>>
  }
  note_tweet?: {
    note_tweet_results?: {
      result?: {
        text?: string
      }
    }
  }
  user?: XTweetUser
  article?: XTweetArticle
  photos?: Array<{
    url?: string
    expanded_url?: string
  }>
  mediaDetails?: Array<{
    type?: string
    media_url_https?: string
    url?: string
  }>
}

interface XGraphqlMediaInfo {
  original_img_url?: string
}

interface XGraphqlMediaEntity {
  media_id?: string
  media_info?: XGraphqlMediaInfo
}

interface XGraphqlArticleBlockEntityMapEntry {
  key?: string
  value?: {
    type?: string
    data?: {
      mediaItems?: Array<{
        mediaId?: string
      }>
    }
  }
}

interface XGraphqlArticleBlock {
  text?: string
  type?: string
  entityRanges?: Array<{
    key?: number | string
  }>
}

interface XGraphqlArticleResult {
  title?: string
  preview_text?: string
  plain_text?: string
  cover_media?: {
    media_info?: XGraphqlMediaInfo
  }
  media_entities?: XGraphqlMediaEntity[]
  content_state?: {
    blocks?: XGraphqlArticleBlock[]
    entityMap?: XGraphqlArticleBlockEntityMapEntry[]
  }
}

interface XGraphqlTweetResultPayload {
  data?: {
    tweetResult?: {
      result?: {
        __typename?: string
        legacy?: {
          created_at?: string
        }
        core?: {
          user_results?: {
            result?: {
              legacy?: {
                name?: string
                screen_name?: string
              }
            }
          }
        }
        article?: {
          article_results?: {
            result?: XGraphqlArticleResult
          }
        }
      }
    }
  }
}

export async function fetchAndExtractX(url: string): Promise<ExtractedArticle | null> {
  try {
    const statusId = extractStatusId(url)
    if (!statusId) {
      return null
    }

    const graphqlPayload = await fetchXGraphqlTweetResult(url, statusId)
    const graphqlExtracted = extractFromXGraphqlTweetResult(graphqlPayload)
    if (graphqlExtracted) {
      return graphqlExtracted
    }

    const payload = await fetchXTweetPayload(statusId)
    return payload ? extractFromXTweetPayload(payload) : null
  } catch {
    return null
  }
}

export function extractFromXTweetPayload(payload: unknown): ExtractedArticle | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const tweet = payload as XTweetPayload
  const text = pickPrimaryText(tweet)
  const articlePreview = collapseWhitespace(tweet.article?.preview_text ?? "")
  const paragraphText = articlePreview || text
  const images = collectPreviewImages(tweet)
  const content = [
    ...(paragraphText
      ? [
          {
            id: "x-p-1",
            type: "paragraph" as const,
            text: paragraphText
          }
        ]
      : []),
    ...images.map((src, index) => ({
      id: `x-img-${index + 1}`,
      type: "image" as const,
      src
    }))
  ]

  if (content.length === 0) {
    return null
  }

  const title = pickPreviewTitle(tweet, paragraphText)
  const author = tweet.user?.name?.trim() || tweet.user?.screen_name?.trim() || undefined

  return {
    title,
    author,
    content,
    summary: buildSummaryFromSections(content, articlePreview || paragraphText || title),
    siteName: "X",
    publishedAt: normalizePublishedAt(tweet.created_at),
    coverImage: findCoverImage(content)
  }
}

export function extractFromXGraphqlTweetResult(payload: unknown): ExtractedArticle | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const tweet = (payload as XGraphqlTweetResultPayload).data?.tweetResult?.result
  const article = tweet?.article?.article_results?.result
  if (!tweet || !article) {
    return null
  }

  const content = buildSectionsFromGraphqlArticle(article)
  if (content.length === 0) {
    return null
  }

  const author =
    tweet.core?.user_results?.result?.legacy?.name?.trim() ||
    tweet.core?.user_results?.result?.legacy?.screen_name?.trim() ||
    undefined
  const title = article.title?.trim() || "X article"
  const summarySource = collapseWhitespace(article.plain_text ?? article.preview_text ?? "")

  return {
    title,
    author,
    content,
    summary: buildSummaryFromSections(content, summarySource || title),
    siteName: "X",
    publishedAt: normalizePublishedAt(tweet.legacy?.created_at),
    coverImage: findCoverImage(content)
  }
}

function extractStatusId(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.pathname.match(/\/status\/(\d+)/)?.[1]
  } catch {
    return undefined
  }
}

async function fetchXTweetPayload(statusId: string): Promise<unknown | null> {
  const endpoint = new URL("https://cdn.syndication.twimg.com/tweet-result")
  endpoint.searchParams.set("id", statusId)
  endpoint.searchParams.set("lang", "en")
  endpoint.searchParams.set("token", "x")

  try {
    const response = await fetch(endpoint.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Lumina-Scout/1.0)",
        Accept: "application/json,text/plain,*/*"
      }
    })
    if (response.ok) {
      return (await response.json()) as unknown
    }
  } catch {
    // Fall through to curl for environments where fetch behaves differently.
  }

  try {
    const { stdout } = await execFileAsync("curl", ["-s", "--max-time", "20", endpoint.toString()])
    return JSON.parse(stdout) as unknown
  } catch {
    return null
  }
}

async function fetchXGraphqlTweetResult(sourceUrl: string, statusId: string): Promise<unknown | null> {
  const guestToken = await fetchXGuestToken(sourceUrl)
  if (!guestToken) {
    return null
  }

  const variables = {
    tweetId: statusId,
    includePromotedContent: false,
    withVoice: false,
    withCommunity: false
  }
  const features = {
    creator_subscriptions_tweet_preview_api_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: true,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: false,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    content_disclosure_indicator_enabled: true,
    content_disclosure_ai_generated_indicator_enabled: true,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    post_ctas_fetch_enabled: true,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false
  }
  const fieldToggles = {
    withArticleRichContentState: true,
    withArticlePlainText: true,
    withArticleSummaryText: true,
    withArticleVoiceOver: false,
    withGrokAnalyze: false,
    withDisallowedReplyControls: false
  }

  const endpoint = new URL(
    `https://x.com/i/api/graphql/${X_TWEET_RESULT_QUERY_ID}/TweetResultByRestId`
  )
  endpoint.searchParams.set("variables", JSON.stringify(variables))
  endpoint.searchParams.set("features", JSON.stringify(features))
  endpoint.searchParams.set("fieldToggles", JSON.stringify(fieldToggles))

  try {
    const { stdout } = await execFileAsync("curl", [
      "-s",
      "--max-time",
      "20",
      "-H",
      `authorization: Bearer ${X_GRAPHQL_BEARER_TOKEN}`,
      "-H",
      `x-guest-token: ${guestToken}`,
      "-H",
      "x-twitter-active-user: yes",
      "-H",
      "x-twitter-client-language: en",
      "-H",
      "user-agent: Mozilla/5.0",
      endpoint.toString()
    ])
    return JSON.parse(stdout) as unknown
  } catch {
    return null
  }
}

async function fetchXGuestToken(sourceUrl: string) {
  try {
    const { stdout } = await execFileAsync("curl", [
      "-s",
      "-L",
      "--max-time",
      "20",
      "-A",
      "Mozilla/5.0",
      sourceUrl
    ])
    return stdout.match(/gt=(\d+)/)?.[1]
  } catch {
    return undefined
  }
}

function buildSectionsFromGraphqlArticle(article: XGraphqlArticleResult) {
  const sections: ExtractedArticle["content"] = []
  const seenImageUrls = new Set<string>()
  const coverImage = article.cover_media?.media_info?.original_img_url
  if (coverImage) {
    sections.push({ id: "x-cover", type: "image", src: coverImage })
    seenImageUrls.add(coverImage)
  }

  const mediaById = new Map<string, string>()
  for (const media of article.media_entities ?? []) {
    const mediaId = media.media_id?.trim()
    const url = media.media_info?.original_img_url?.trim()
    if (mediaId && url) {
      mediaById.set(mediaId, url)
    }
  }

  let paragraphIndex = 0
  let imageIndex = sections.length

  for (const block of article.content_state?.blocks ?? []) {
    const blockType = block.type?.trim() || "unstyled"
    if (blockType === "atomic") {
      const blockImages = collectGraphqlBlockImages(block, article.content_state?.entityMap, mediaById)
      for (const src of blockImages) {
        if (seenImageUrls.has(src)) {
          continue
        }
        seenImageUrls.add(src)
        imageIndex += 1
        sections.push({
          id: `x-img-${imageIndex}`,
          type: "image",
          src
        })
      }
      continue
    }

    const text = collapseWhitespace(block.text ?? "")
    if (!text) {
      continue
    }
    paragraphIndex += 1
    sections.push({
      id: `x-p-${paragraphIndex}`,
      type: "paragraph",
      text
    })
  }

  if (sections.length === 0) {
    const plainText = collapseWhitespace(article.plain_text ?? "")
    if (plainText) {
      sections.push({
        id: "x-p-1",
        type: "paragraph",
        text: plainText
      })
    }
  }

  return sections
}

function collectGraphqlBlockImages(
  block: XGraphqlArticleBlock,
  entityMap: XGraphqlArticleBlockEntityMapEntry[] | undefined,
  mediaById: Map<string, string>
) {
  const imageUrls: string[] = []
  for (const entityRange of block.entityRanges ?? []) {
    const entry = entityMap?.find((item) => String(item.key) === String(entityRange.key))
    for (const mediaItem of entry?.value?.data?.mediaItems ?? []) {
      const src = mediaItem.mediaId ? mediaById.get(mediaItem.mediaId) : undefined
      if (src) {
        imageUrls.push(src)
      }
    }
  }
  return imageUrls
}

function pickPrimaryText(tweet: XTweetPayload) {
  const rawText =
    tweet.note_tweet?.note_tweet_results?.result?.text ??
    tweet.full_text ??
    tweet.text ??
    ""
  if (!rawText.trim()) {
    return ""
  }

  const displayText = sliceByDisplayRange(rawText, tweet.display_text_range)
  return stripUrlEntities(displayText, tweet.entities?.urls)
}

function pickPreviewTitle(tweet: XTweetPayload, paragraphText: string) {
  const articleTitle = tweet.article?.title?.trim()
  if (articleTitle) {
    return articleTitle
  }
  if (paragraphText) {
    return paragraphText.length > 80 ? `${paragraphText.slice(0, 80).trim()}...` : paragraphText
  }
  const author = tweet.user?.name?.trim() || tweet.user?.screen_name?.trim()
  return author ? `${author} on X` : "X post"
}

function sliceByDisplayRange(text: string, range?: [number, number]) {
  if (!range || range.length !== 2) {
    return collapseWhitespace(text)
  }
  const glyphs = Array.from(text)
  return collapseWhitespace(glyphs.slice(range[0], range[1]).join(""))
}

function stripUrlEntities(text: string, urls?: XTweetUrlEntity[]) {
  if (!text) {
    return ""
  }
  let cleaned = text
  for (const entity of urls ?? []) {
    for (const candidate of [entity.url, entity.expanded_url]) {
      if (!candidate) {
        continue
      }
      cleaned = cleaned.replaceAll(candidate, " ")
    }
  }
  return collapseWhitespace(cleaned.replace(/https?:\/\/\S+/g, " "))
}

function collectPreviewImages(tweet: XTweetPayload) {
  const imageCandidates: string[] = []

  for (const photo of tweet.photos ?? []) {
    if (typeof photo.url === "string" && photo.url) {
      imageCandidates.push(photo.url)
    }
  }

  for (const media of tweet.mediaDetails ?? []) {
    if (media.type === "photo") {
      const src = media.media_url_https ?? media.url
      if (src) {
        imageCandidates.push(src)
      }
    }
  }

  for (const media of tweet.extended_entities?.media ?? []) {
    const src = pickMediaUrl(media)
    if (src) {
      imageCandidates.push(src)
    }
  }

  for (const media of tweet.entities?.media ?? []) {
    const src = pickMediaUrl(media)
    if (src) {
      imageCandidates.push(src)
    }
  }

  const coverImage = tweet.article?.cover_media?.media_info?.original_img_url
  if (coverImage) {
    imageCandidates.push(coverImage)
  }

  return Array.from(new Set(imageCandidates.filter(Boolean)))
}

function pickMediaUrl(media: Record<string, unknown>) {
  const direct = [media.media_url_https, media.media_url, media.url].find(
    (value) => typeof value === "string" && value.startsWith("http")
  )
  return typeof direct === "string" ? direct : undefined
}

function normalizePublishedAt(value?: string) {
  if (!value) {
    return undefined
  }
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return undefined
  }
  return new Date(timestamp).toISOString()
}
