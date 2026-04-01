import { Hono } from "hono"
import { z } from "zod"
import { formatServerTiming } from "@/src/lib/timing"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import { invalidateViewpoints } from "@/src/server/repositories/cached"
import { exportTaskAsPdf } from "@/src/server/services/publish/service"
import {
  buildObjectResponse,
  getBookObjectBuffer,
  getStoredObjectContentType,
  uploadStoredObject
} from "@/src/server/services/books/minio"

const app = new Hono<AppEnv>()

app.get("/tree", (c) => {
  return c.json({ items: repository.listViewpoints(c.get("userId"), { metadataOnly: true }) })
})

app.post("/", async (c) => {
  const userId = c.get("userId")
  const payload = z
    .object({
      title: z.string().min(1),
      parentId: z.string().optional(),
      isFolder: z.boolean().default(false)
    })
    .parse(await c.req.json())
  const item = repository.createViewpoint({
    userId,
    title: payload.title,
    parentId: payload.parentId,
    isFolder: payload.isFolder,
    isCandidate: false,
    sortOrder: repository.listViewpoints(userId, { metadataOnly: true }).length + 1,
    articleContent: "",
    relatedBookIds: []
  })
  void invalidateViewpoints(userId)
  return c.json({ item })
})

app.get("/:id", (c) => {
  const item = repository.getViewpoint(c.get("userId"), c.req.param("id"))
  if (!item) {
    return c.json({ error: "观点不存在" }, 404)
  }
  return c.json({ item })
})

app.put("/:id", async (c) => {
  const userId = c.get("userId")
  const payload = z
    .object({
      title: z.string().optional(),
      parentId: z.string().optional(),
      sortOrder: z.number().optional()
    })
    .parse(await c.req.json())
  const item = repository.updateViewpoint(userId, c.req.param("id"), payload)
  void invalidateViewpoints(userId)
  return c.json({ item })
})

app.delete("/:id", (c) => {
  const userId = c.get("userId")
  repository.deleteViewpoint(userId, c.req.param("id"))
  void invalidateViewpoints(userId)
  return c.json({ ok: true })
})

app.put("/:id/article", async (c) => {
  const userId = c.get("userId")
  const payload = z.object({ articleContent: z.string() }).parse(await c.req.json())
  const item = repository.updateViewpoint(userId, c.req.param("id"), {
    articleContent: payload.articleContent,
    lastSynthesizedAt: new Date().toISOString()
  })
  void invalidateViewpoints(userId)
  return c.json({ item })
})

/** 获取观点的块状笔记内容 */
app.get("/:id/blocks", (c) => {
  const startedAt = performance.now()
  const userId = c.get("userId")
  const viewpointId = c.req.param("id")
  const metaStartedAt = performance.now()
  const item = repository.getViewpoint(userId, viewpointId)
  const metaDuration = performance.now() - metaStartedAt
  if (!item) {
    return c.json({ error: "观点不存在" }, 404)
  }
  const blocksStartedAt = performance.now()
  const blocks = repository.getViewpointBlocks(userId, viewpointId)
  const blocksDuration = performance.now() - blocksStartedAt
  const totalDuration = performance.now() - startedAt
  c.header("Server-Timing", formatServerTiming([
    { name: "meta", duration: metaDuration, description: "viewpoint-meta" },
    { name: "blocks", duration: blocksDuration, description: "viewpoint-blocks" },
    { name: "total", duration: totalDuration, description: "viewpoint-route" }
  ]))
  c.header("X-Lumina-Viewpoint-Id", viewpointId)
  return c.json({ blocks })
})

/** 更新观点的块状笔记内容 */
app.put("/:id/blocks", async (c) => {
  const userId = c.get("userId")
  const payload = z.object({ blocks: z.array(z.any()) }).parse(await c.req.json())
  const item = repository.updateViewpointBlocks(userId, c.req.param("id"), payload.blocks)
  void invalidateViewpoints(userId)
  return c.json({ item })
})

/**
 * 上传笔记图片到 MinIO
 */
app.post("/:id/images", async (c) => {
  const userId = c.get("userId")
  const viewpointId = c.req.param("id")
  const formData = await c.req.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return c.json({ error: "Missing file" }, 400)
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const extension = file.name.split(".").pop() ?? "png"
  const imageId = crypto.randomUUID()
  const objectName = `notes/${userId}/${viewpointId}/${imageId}.${extension}`
  await uploadStoredObject({
    objectName,
    buffer,
    contentType: file.type || "image/png"
  })
  return c.json({
    objectKey: objectName,
    originalName: file.name,
    url: `/api/viewpoints/${viewpointId}/images/${imageId}.${extension}`
  })
})

/**
 * 获取笔记图片
 */
app.get("/:id/images/:fileName", async (c) => {
  const userId = c.get("userId")
  const viewpointId = c.req.param("id")
  const fileName = c.req.param("fileName")
  const objectName = `notes/${userId}/${viewpointId}/${fileName}`
  const buffer = await getBookObjectBuffer("lumina-books", objectName)
  if (!buffer) {
    return c.json({ error: "Image not found" }, 404)
  }
  const contentType = getStoredObjectContentType(fileName)
  const response = buildObjectResponse(buffer, {
    contentType,
    rangeHeader: c.req.header("range")
  })
  return new Response(new Uint8Array(response.body), {
    status: response.status,
    headers: response.headers
  })
})

app.get("/:id/highlights", (c) => {
  const viewpointId = c.req.param("id")
  const items = repository
    .listUnconfirmedHighlights(c.get("userId"), viewpointId)
    .concat([])
  return c.json({ items })
})

app.get("/:id/related", (c) => {
  return c.json({
    items: repository.listRelatedViewpoints(c.get("userId"), c.req.param("id"))
  })
})

app.post("/:id/send-email", (c) => {
  return c.json({
    ok: true,
    message: "当前版本使用本地模拟发送，邮件发送服务可继续替换。"
  })
})

app.get("/:id/export", async (c) => {
  const item = repository.getViewpoint(c.get("userId"), c.req.param("id"), { includeBlocks: true })
  if (!item) {
    return c.json({ error: "观点不存在" }, 404)
  }
  const format = c.req.query("format") ?? "markdown"
  if (format === "pdf") {
    const buffer = await exportTaskAsPdf(item.articleContent)
    c.header("Content-Type", "application/pdf")
    c.header(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(item.title)}.pdf"`
    )
    return c.body(new Uint8Array(buffer))
  }
  c.header("Content-Type", "text/markdown; charset=utf-8")
  c.header(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(item.title)}.md"`
  )
  return c.body(item.articleContent)
})

export default app
