import { Hono } from "hono"
import { z } from "zod"
import { maskSecret } from "@/src/lib/utils"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"

const modelSchema = z.object({
  baseUrl: z.string().optional().default(""),
  apiKey: z.string().optional().default(""),
  modelName: z.string().optional().default(""),
  usage: z.enum(["aggregation", "synthesis", "explain", "embedding"])
})

const app = new Hono<AppEnv>()

app.get("/models", (c) => {
  return c.json({
    items: repository.listModelConfigs(c.get("userId")).map((item) => ({
      ...item,
      apiKey: item.apiKey ? maskSecret(item.apiKey) : ""
    }))
  })
})

app.put("/models/:usage", async (c) => {
  const payload = modelSchema.parse({
    ...(await c.req.json()),
    usage: c.req.param("usage")
  })
  const item = repository.saveModelConfig(c.get("userId"), payload)
  return c.json({ item })
})

app.delete("/models/:usage", (c) => {
  repository.deleteModelConfig(c.get("userId"), c.req.param("usage") as never)
  return c.json({ ok: true })
})

app.post("/models/test", async (c) => {
  const payload = modelSchema.parse(await c.req.json())
  if (!payload.baseUrl || !payload.modelName) {
    return c.json({ success: false, error: "配置不完整" }, 400)
  }
  return c.json({ success: true, usage: payload.usage })
})

app.get("/storage", (c) => {
  return c.json({ item: repository.getStorageConfig(c.get("userId")) })
})

app.put("/storage", async (c) => {
  const payload = z
    .object({
      useCustom: z.boolean(),
      endpoint: z.string().optional(),
      accessKey: z.string().optional(),
      secretKey: z.string().optional(),
      bucket: z.string().optional(),
      region: z.string().optional()
    })
    .parse(await c.req.json())
  const item = repository.saveStorageConfig(c.get("userId"), {
    userId: c.get("userId"),
    ...payload
  })
  return c.json({ item })
})

app.get("/schedule", (c) => {
  const user = repository.getUserById(c.get("userId"))
  return c.json({
    item: {
      aggregateSchedule: user?.aggregateSchedule ?? "manual",
      aggregateCron: user?.aggregateCron ?? ""
    }
  })
})

app.put("/schedule", async (c) => {
  const payload = z
    .object({
      aggregateSchedule: z.enum(["manual", "daily", "weekly"]),
      aggregateCron: z.string().optional()
    })
    .parse(await c.req.json())
  const user = repository.updateUser(c.get("userId"), payload)
  return c.json({ item: user })
})

app.get("/reader", (c) => {
  return c.json({ item: repository.getReaderSettings(c.get("userId")) })
})

app.put("/reader", async (c) => {
  const payload = z
    .object({
      fontSize: z.union([z.literal(14), z.literal(16), z.literal(18), z.literal(20), z.literal(22)]),
      lineHeight: z.union([z.literal(1.5), z.literal(1.6), z.literal(1.75), z.literal(2)]),
      fontFamily: z.enum(["system", "serif", "sans"]),
      theme: z.enum(["day", "sepia", "night"]),
      navigationMode: z.enum(["horizontal", "vertical"])
    })
    .parse(await c.req.json())
  const item = repository.updateReaderSettings(c.get("userId"), payload)
  return c.json({ item })
})

export default app
