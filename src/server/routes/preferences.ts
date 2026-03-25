import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import {
  getUiPreferences,
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
      articleSortBy: z.enum(["lastRead", "created"]).optional()
    })
    .parse(await c.req.json())
  return c.json({ item: await saveUiPreferences(c.get("userId"), payload) })
})

export default app
