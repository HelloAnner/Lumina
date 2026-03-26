import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import { syncPendingHighlights } from "@/src/server/services/aggregation/highlight-sync"
import { deleteHighlightVector } from "@/src/server/services/aggregation/vector-store"

const app = new Hono<AppEnv>()
const pdfRectSchema = z.object({
  left: z.number().min(0),
  top: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive()
})

app.post("/", async (c) => {
  const payload = z
    .object({
      bookId: z.string(),
      format: z.enum(["PDF", "EPUB"]),
      assetType: z.enum(["text", "image"]).optional(),
      contentMode: z.enum(["original", "translation"]).optional(),
      sourceTitle: z.string().optional(),
      sourceSectionTitle: z.string().optional(),
      targetLanguage: z.string().optional(),
      counterpartContent: z.string().optional(),
      counterpartParaOffsetStart: z.number().optional(),
      counterpartParaOffsetEnd: z.number().optional(),
      pageIndex: z.number().optional(),
      pdfRects: z.array(pdfRectSchema).optional(),
      paraOffsetStart: z.number().optional(),
      paraOffsetEnd: z.number().optional(),
      cfiRange: z.string().optional(),
      chapterHref: z.string().optional(),
      imageUrl: z.string().optional(),
      imageObjectKey: z.string().optional(),
      imageAlt: z.string().optional(),
      content: z.string().min(1),
      note: z.string().optional(),
      color: z.enum(["yellow", "green", "blue", "pink"]),
      immediateSync: z.boolean().optional()
    })
    .parse(await c.req.json())
  const userId = c.get("userId")
  const highlight = repository.createHighlight({
    userId,
    ...payload,
    contentMode: payload.contentMode ?? "original"
  })

  if (payload.immediateSync) {
    await syncPendingHighlights(userId).catch((err) => {
      console.error("[highlight-sync] sync failed:", err)
    })
  } else {
    // 后台同步划线到主题树（不阻塞响应，不弹通知）
    void syncPendingHighlights(userId).catch((err) => {
      console.error("[highlight-sync] sync failed:", err)
    })
  }

  return c.json({ item: highlight })
})

app.put("/:id", async (c) => {
  const payload = z
    .object({
      note: z.string().optional(),
      color: z.enum(["yellow", "green", "blue", "pink"]).optional()
    })
    .parse(await c.req.json())
  const highlight = repository.updateHighlight(
    c.get("userId"),
    c.req.param("id"),
    payload
  )
  return c.json({ item: highlight })
})

app.delete("/:id", (c) => {
  const highlightId = c.req.param("id")
  repository.deleteHighlight(c.get("userId"), highlightId)
  /** 异步清理向量存储 */
  void deleteHighlightVector(highlightId).catch(() => undefined)
  return c.json({ ok: true })
})

app.get("/:viewpointId/unconfirmed", (c) => {
  return c.json({
    items: repository.listUnconfirmedHighlights(
      c.get("userId"),
      c.req.param("viewpointId")
    )
  })
})

app.put("/viewpoint-link/:highlightId/:viewpointId", async (c) => {
  const payload = z.object({ confirmed: z.boolean() }).parse(await c.req.json())
  const result = repository.upsertHighlightLink({
    highlightId: c.req.param("highlightId"),
    viewpointId: c.req.param("viewpointId"),
    similarityScore: payload.confirmed ? 0.88 : 0.72,
    confirmed: payload.confirmed
  })
  return c.json({ item: result })
})

export default app
