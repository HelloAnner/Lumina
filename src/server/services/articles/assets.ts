/**
 * 文章图片资产服务
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import { randomUUID } from "node:crypto"
import {
  buildArticleAssetObjectName,
  removeBookObject,
  uploadStoredObject
} from "@/src/server/services/books/minio"
import type { ArticleSection, ScoutArticle } from "@/src/server/store/types"

function inferExtension(contentType: string, sourceUrl: string) {
  if (contentType.includes("png")) {
    return "png"
  }
  if (contentType.includes("webp")) {
    return "webp"
  }
  if (contentType.includes("gif")) {
    return "gif"
  }
  if (contentType.includes("svg")) {
    return "svg"
  }
  const matched = sourceUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
  if (matched?.[1]) {
    return matched[1].toLowerCase()
  }
  return "jpg"
}

export function buildArticleAssetProxyPath(articleId: string, assetId: string) {
  return `/api/articles/${articleId}/assets/${assetId}`
}

export function buildPublicArticleAssetProxyPath(token: string, assetId: string) {
  return `/api/shares/public/${token}/articles/assets/${assetId}`
}

function findImageSections(content: ArticleSection[]) {
  return content.filter(
    (item): item is ArticleSection & { type: "image"; src: string } =>
      item.type === "image" && typeof item.src === "string" && item.src.length > 0
  )
}

async function downloadImage(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Lumina-ArticleAsset/1.0)",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
    }
  })
  if (!response.ok) {
    throw new Error(`image download failed: ${response.status}`)
  }
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.startsWith("image/")) {
    throw new Error("asset is not image")
  }
  const arrayBuffer = await response.arrayBuffer()
  return {
    contentType,
    buffer: Buffer.from(arrayBuffer)
  }
}

export async function persistArticleAssets(params: {
  userId: string
  articleId: string
  content: ArticleSection[]
  coverImage?: string
}) {
  const coverCandidates = new Map<string, string>()
  const nextContent = await Promise.all(
    params.content.map(async (section) => {
      if (section.type !== "image" || !section.src || !/^https?:\/\//.test(section.src)) {
        return section
      }
      try {
        const assetId = section.assetId || section.id || randomUUID()
        const downloaded = await downloadImage(section.src)
        const extension = inferExtension(downloaded.contentType, section.src)
        const objectName = buildArticleAssetObjectName(
          params.userId,
          params.articleId,
          assetId,
          extension
        )
        await uploadStoredObject({
          objectName,
          buffer: downloaded.buffer,
          contentType: downloaded.contentType
        })
        const proxyPath = buildArticleAssetProxyPath(params.articleId, assetId)
        coverCandidates.set(section.src, proxyPath)
        return {
          ...section,
          assetId,
          objectKey: objectName,
          src: proxyPath
        }
      } catch {
        return section
      }
    })
  )

  const firstImage = findImageSections(nextContent)[0]
  return {
    content: nextContent,
    coverImage:
      (params.coverImage && coverCandidates.get(params.coverImage)) ||
      firstImage?.src ||
      params.coverImage
  }
}

export function findArticleImageSection(article: ScoutArticle, assetId: string) {
  return article.content.find(
    (item) => item.type === "image" && item.assetId === assetId
  )
}

export async function removeArticleAssets(article: ScoutArticle) {
  const imageSections = findImageSections(article.content)
  await Promise.all(
    imageSections.map(async (section) => {
      if (section.objectKey) {
        await removeBookObject("lumina-books", section.objectKey)
      }
    })
  )
}
