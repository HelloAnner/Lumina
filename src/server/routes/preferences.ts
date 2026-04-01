import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { invalidateSettings } from "@/src/server/repositories/cached"
import {
  getKnowledgeNoteState,
  getReaderLayoutState,
  getUiPreferences,
  saveKnowledgeNoteState,
  saveReaderLayoutState,
  saveUiPreferences
} from "@/src/server/services/preferences/store"

const app = new Hono<AppEnv>()

app.get("/ui", async (c) => {
  return c.json({ item: await getUiPreferences(c.get("userId")) })
})

app.put("/ui", async (c) => {
  const payload = z
    .object({
      knowledgeTreeWidth: z.number().min(180).max(420).optional(),
      knowledgeListWidth: z.number().min(220).max(420).optional(),
      readerTocWidth: z.number().min(200).max(420).optional(),
      readerHighlightsWidth: z.number().min(260).max(480).optional(),
      articleOutlineWidth: z.number().min(180).max(360).optional(),
      articleSortBy: z.enum(["lastRead", "created"]).optional()
    })
    .parse(await c.req.json())
  const userId = c.get("userId")
  const item = await saveUiPreferences(userId, payload)
  void invalidateSettings(userId)
  return c.json({ item })
})

app.get("/knowledge-note", async (c) => {
  const query = z.object({
    noteKey: z.string().min(1)
  }).parse(c.req.query())
  return c.json({
    item: await getKnowledgeNoteState(c.get("userId"), query.noteKey)
  })
})

app.put("/knowledge-note", async (c) => {
  const payload = z.object({
    noteKey: z.string().min(1),
    outlineCollapsed: z.boolean().optional(),
    scrollTop: z.number().min(0).max(2_000_000).optional(),
    anchorHeadingId: z.string().max(160).nullable().optional()
  }).parse(await c.req.json())
  const userId = c.get("userId")
  const item = await saveKnowledgeNoteState(userId, payload.noteKey, {
    outlineCollapsed: payload.outlineCollapsed,
    scrollTop: payload.scrollTop,
    anchorHeadingId: payload.anchorHeadingId ?? undefined
  })
  void invalidateSettings(userId)
  return c.json({ item })
})

app.get("/reader-layout", async (c) => {
  const query = z.object({
    resourceType: z.enum(["book", "article"]),
    resourceId: z.string().min(1)
  }).parse(c.req.query())
  return c.json({
    item: await getReaderLayoutState(
      c.get("userId"),
      query.resourceType,
      query.resourceId
    )
  })
})

app.put("/reader-layout", async (c) => {
  const payload = z.object({
    resourceType: z.enum(["book", "article"]),
    resourceId: z.string().min(1),
    outlineCollapsed: z.boolean().optional(),
    notesCollapsed: z.boolean().optional()
  }).parse(await c.req.json())
  const userId = c.get("userId")
  const item = await saveReaderLayoutState(
    userId,
    payload.resourceType,
    payload.resourceId,
    {
      outlineCollapsed: payload.outlineCollapsed,
      notesCollapsed: payload.notesCollapsed
    }
  )
  void invalidateSettings(userId)
  return c.json({ item })
})

export default app
