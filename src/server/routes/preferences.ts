import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import {
  getKnowledgeNoteState,
  getUiPreferences,
  saveKnowledgeNoteState,
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
  return c.json({ item: await saveUiPreferences(c.get("userId"), payload) })
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
  return c.json({
    item: await saveKnowledgeNoteState(c.get("userId"), payload.noteKey, {
      outlineCollapsed: payload.outlineCollapsed,
      scrollTop: payload.scrollTop,
      anchorHeadingId: payload.anchorHeadingId ?? undefined
    })
  })
})

export default app
