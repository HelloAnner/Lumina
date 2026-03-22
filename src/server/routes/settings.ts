import { Hono } from "hono"
import { z } from "zod"
import { maskSecret } from "@/src/lib/utils"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"

const modelSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  baseUrl: z.string().optional().default(""),
  apiKey: z.string().optional().default(""),
  modelName: z.string().optional().default(""),
  category: z.enum(["language", "speech", "embedding"])
})

const bindingSchema = z.object({
  feature: z.enum([
    "instant_explain",
    "article_generate",
    "aggregation_analyze",
    "voice_read",
    "embedding_index"
  ]),
  modelId: z.string()
})

const app = new Hono<AppEnv>()

app.get("/models", (c) => {
  return c.json({
    items: repository.listModelConfigs(c.get("userId")).map((item) => ({
      ...item,
      apiKey: item.apiKey ? maskSecret(item.apiKey) : ""
    })),
    bindings: repository.listModelBindings(c.get("userId"))
  })
})

app.post("/models", async (c) => {
  const payload = modelSchema.parse(await c.req.json())
  const item = repository.saveModelConfig(c.get("userId"), payload)
  return c.json({ item })
})

app.put("/models/:id", async (c) => {
  const payload = modelSchema.parse({
    ...(await c.req.json()),
    id: c.req.param("id")
  })
  const item = repository.saveModelConfig(c.get("userId"), payload)
  return c.json({ item })
})

app.delete("/models/:id", (c) => {
  repository.deleteModelConfig(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

app.post("/models/test", async (c) => {
  const payload = modelSchema.parse(await c.req.json())
  if (!payload.baseUrl || !payload.modelName) {
    return c.json({ success: false, error: "配置不完整" }, 400)
  }
  try {
    if (payload.category === "embedding") {
      const response = await fetch(
        `${payload.baseUrl.replace(/\/$/, "")}/embeddings`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${payload.apiKey}`
          },
          body: JSON.stringify({
            model: payload.modelName,
            input: "hello"
          })
        }
      )
      if (!response.ok) {
        throw new Error("embedding test failed")
      }
    } else if (payload.category === "speech") {
      const response = await fetch(
        `${payload.baseUrl.replace(/\/$/, "")}/audio/speech`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${payload.apiKey}`
          },
          body: JSON.stringify({
            model: payload.modelName,
            input: "hello",
            voice: "alloy"
          })
        }
      )
      if (!response.ok) {
        throw new Error("speech test failed")
      }
    } else {
      const response = await fetch(
        `${payload.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${payload.apiKey}`
          },
          body: JSON.stringify({
            model: payload.modelName,
            messages: [{ role: "user", content: "hello" }]
          })
        }
      )
      if (!response.ok) {
        throw new Error("language test failed")
      }
    }
    return c.json({ success: true })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "连通失败"
      },
      400
    )
  }
})

app.get("/model-bindings", (c) => {
  return c.json({ items: repository.listModelBindings(c.get("userId")) })
})

app.put("/model-bindings", async (c) => {
  const payload = bindingSchema.parse(await c.req.json())
  const item = repository.saveModelBinding(c.get("userId"), payload)
  return c.json({ item })
})

app.get("/storage", (c) => {
  return c.json({
    item: {
      mode: "platform-default",
      endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:29000",
      bucket: process.env.MINIO_BUCKET ?? "lumina-books"
    }
  })
})

app.put("/storage", async (c) => {
  return c.json({ ok: true, message: "平台默认存储无需自定义配置" })
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
