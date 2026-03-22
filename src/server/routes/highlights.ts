import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"

const app = new Hono<AppEnv>()

app.post("/", async (c) => {
  const payload = z
    .object({
      bookId: z.string(),
      format: z.enum(["PDF", "EPUB"]),
      pageIndex: z.number().optional(),
      paraOffsetStart: z.number().optional(),
      paraOffsetEnd: z.number().optional(),
      cfiRange: z.string().optional(),
      chapterHref: z.string().optional(),
      content: z.string().min(1),
      note: z.string().optional(),
      color: z.enum(["yellow", "green", "blue", "pink"])
    })
    .parse(await c.req.json())
  const highlight = repository.createHighlight({
    userId: c.get("userId"),
    ...payload
  })
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
  repository.deleteHighlight(c.get("userId"), c.req.param("id"))
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
