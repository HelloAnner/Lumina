/**
 * 分享链接路由
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import path from "node:path"
import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { requireAuth } from "@/src/server/middleware/auth"
import { repository } from "@/src/server/repositories"
import { findArticleImageSection } from "@/src/server/services/articles/assets"
import { repairStoredBook } from "@/src/server/services/books/book-repair"
import {
  buildBookObjectName,
  buildObjectResponse,
  getBookObjectBuffer,
  getStoredObjectContentType,
  parseMinioPath
} from "@/src/server/services/books/minio"
import {
  getBookFromStore,
  getBookObjectLocationFromStore
} from "@/src/server/services/books/store"
import {
  buildShareUrl,
  createShareToken,
  resolveShareExpiration
} from "@/src/server/services/share/share-links"

const app = new Hono<AppEnv>()

const createShareSchema = z.object({
  resourceType: z.enum(["book", "article"]),
  resourceId: z.string().min(1),
  duration: z.enum(["24h", "7d", "30d", "never"])
})

async function resolveSharedBook(token: string) {
  const shareLink = repository.getActiveShareLinkByToken(token)
  if (!shareLink || shareLink.resourceType !== "book") {
    return null
  }
  const storedBook = await getBookFromStore(shareLink.ownerUserId, shareLink.resourceId)
  const book = storedBook ? await repairStoredBook(storedBook) : null
  if (!book) {
    return null
  }
  repository.touchShareLink(token)
  return {
    shareLink,
    book
  }
}

app.post("/", requireAuth, async (c) => {
  const payload = createShareSchema.parse(await c.req.json())
  const userId = c.get("userId")

  if (payload.resourceType === "book") {
    const book = await getBookFromStore(userId, payload.resourceId)
    if (!book) {
      return c.json({ error: "书籍不存在" }, 404)
    }
  } else {
    const article = repository.getArticle(userId, payload.resourceId)
    if (!article) {
      return c.json({ error: "文章不存在" }, 404)
    }
  }

  const item = repository.createShareLink({
    token: createShareToken(),
    ownerUserId: userId,
    resourceType: payload.resourceType,
    resourceId: payload.resourceId,
    expiresAt: resolveShareExpiration(payload.duration)
  })
  const shareUrl = buildShareUrl(repository.getShareEndpointConfig(), item.token)
  return c.json({ item, shareUrl })
})

app.on(["GET", "HEAD"], "/public/:token/file", async (c) => {
  const resolved = await resolveSharedBook(c.req.param("token"))
  if (!resolved) {
    return c.json({ error: "分享链接不可用" }, 404)
  }

  const objectLocation = await getBookObjectLocationFromStore(
    resolved.shareLink.ownerUserId,
    resolved.book.id
  )
  const buffer = objectLocation
    ? await getBookObjectBuffer(objectLocation.bucket, objectLocation.objectName)
    : null
  if (!buffer) {
    return c.json({ error: "文件不存在" }, 404)
  }

  const payload = buildObjectResponse(buffer, {
    contentType: getStoredObjectContentType(objectLocation?.storedPath ?? resolved.book.filePath),
    rangeHeader: c.req.header("range")
  })
  const fileName = path.basename(objectLocation?.objectName ?? resolved.book.filePath)
  const headers = new Headers(payload.headers)
  headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`)
  headers.set("Cache-Control", "public, max-age=900")

  if (c.req.method === "HEAD") {
    return new Response(null, {
      headers,
      status: payload.status
    })
  }

  return new Response(new Uint8Array(payload.body), {
    headers,
    status: payload.status
  })
})

app.get("/public/:token/page-images/:pageNumber", async (c) => {
  const resolved = await resolveSharedBook(c.req.param("token"))
  if (!resolved) {
    return c.json({ error: "分享链接不可用" }, 404)
  }

  const objectLocation = await getBookObjectLocationFromStore(
    resolved.shareLink.ownerUserId,
    resolved.book.id
  )
  const buffer = await getBookObjectBuffer(
    objectLocation?.bucket ?? parseMinioPath(resolved.book.filePath)?.bucket ?? "lumina-books",
    buildBookObjectName(
      resolved.shareLink.ownerUserId,
      resolved.book.id,
      `page-images/${c.req.param("pageNumber")}.png`
    )
  )
  if (!buffer) {
    return c.json({ error: "页图不存在" }, 404)
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "public, max-age=900",
      "Content-Type": "image/png"
    },
    status: 200
  })
})

app.get("/public/:token/articles/assets/:assetId", async (c) => {
  const shareLink = repository.getActiveShareLinkByToken(c.req.param("token"))
  if (!shareLink || shareLink.resourceType !== "article") {
    return c.json({ error: "分享链接不可用" }, 404)
  }
  const article = repository.getArticle(shareLink.ownerUserId, shareLink.resourceId)
  if (!article) {
    return c.json({ error: "Article not found" }, 404)
  }
  const imageSection = findArticleImageSection(article, c.req.param("assetId"))
  if (!imageSection?.objectKey) {
    return c.json({ error: "Asset not found" }, 404)
  }
  const buffer = await getBookObjectBuffer("lumina-books", imageSection.objectKey)
  if (!buffer) {
    return c.json({ error: "Asset not found" }, 404)
  }
  repository.touchShareLink(c.req.param("token"))
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=900",
      "Content-Type": getStoredObjectContentType(imageSection.objectKey)
    }
  })
})

export default app
