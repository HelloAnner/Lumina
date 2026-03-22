import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import {
  renderTaskContentById,
  triggerPublish
} from "@/src/server/services/publish/service"

const targetSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["webhook", "kms"]),
  endpointUrl: z.string().url(),
  authHeader: z.string().optional()
})

const taskSchema = z.object({
  name: z.string().min(1),
  viewpointIds: z.array(z.string()).min(1),
  targetId: z.string(),
  format: z.enum(["markdown", "html", "pdf"]),
  triggerType: z.enum(["manual", "cron", "on_change"]),
  cronExpr: z.string().optional(),
  onChangeDelay: z.number().optional(),
  enabled: z.boolean().default(true)
})

const app = new Hono<AppEnv>()

app.get("/targets", (c) => {
  return c.json({ items: repository.listPublishTargets(c.get("userId")) })
})

app.post("/targets", async (c) => {
  const payload = targetSchema.parse(await c.req.json())
  const item = repository.createPublishTarget(c.get("userId"), payload)
  return c.json({ item })
})

app.put("/targets/:id", async (c) => {
  const payload = targetSchema.partial().parse(await c.req.json())
  const item = repository.updatePublishTarget(
    c.get("userId"),
    c.req.param("id"),
    payload
  )
  return c.json({ item })
})

app.delete("/targets/:id", (c) => {
  repository.deletePublishTarget(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

app.get("/tasks", (c) => {
  return c.json({ items: repository.listPublishTasks(c.get("userId")) })
})

app.post("/tasks", async (c) => {
  const payload = taskSchema.parse(await c.req.json())
  const item = repository.createPublishTask(c.get("userId"), payload)
  return c.json({ item })
})

app.put("/tasks/:id", async (c) => {
  const payload = taskSchema.partial().parse(await c.req.json())
  const item = repository.updatePublishTask(
    c.get("userId"),
    c.req.param("id"),
    payload
  )
  return c.json({ item })
})

app.delete("/tasks/:id", (c) => {
  repository.deletePublishTask(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

app.post("/tasks/:id/trigger", async (c) => {
  const record = await triggerPublish(c.get("userId"), c.req.param("id"))
  return c.json({ item: record })
})

app.get("/tasks/:id/records", (c) => {
  return c.json({ items: repository.listPublishRecords(c.req.param("id")) })
})

app.get("/tasks/:id/content", (c) => {
  return c.json({ content: renderTaskContentById(c.get("userId"), c.req.param("id")) })
})

export default app
