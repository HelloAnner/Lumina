import { Hono } from "hono"
import { z } from "zod"
import { maskSecret } from "@/src/lib/utils"
import { decryptValue } from "@/src/server/lib/crypto"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import type { ModelCategory } from "@/src/server/store/types"

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
    "embedding_index",
    "section_translate",
    "annotation_rewrite",
    "scout_analyze",
    "scout_expand"
  ]),
  modelId: z.string()
})

const app = new Hono<AppEnv>()

function normalizeErrorDetail(detail: string) {
  return detail.replace(/\s+/g, " ").trim().slice(0, 300)
}

function extractErrorDetail(body: string) {
  if (!body.trim()) {
    return ""
  }
  try {
    const data = JSON.parse(body) as {
      error?: { message?: string }
      message?: string
      detail?: string
      errors?: Array<{ message?: string }>
    }
    return normalizeErrorDetail(
      data.error?.message ??
        data.message ??
        data.detail ??
        data.errors?.[0]?.message ??
        body
    )
  } catch {
    return normalizeErrorDetail(body)
  }
}

async function buildUpstreamError(prefix: string, response: Response) {
  const body = await response.text().catch(() => "")
  const detail = extractErrorDetail(body)
  if (!detail) {
    return `${prefix} test failed (${response.status})`
  }
  return `${prefix} test failed (${response.status}): ${detail}`
}

async function ensureEmbeddingTestPassed(response: Response) {
  if (!response.ok) {
    throw new Error(await buildUpstreamError("embedding", response))
  }
  const data = await response.json().catch(() => null)
  const embedding = data?.data?.[0]?.embedding
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("embedding test failed: empty vector")
  }
}

async function ensureSpeechTestPassed(response: Response) {
  if (!response.ok) {
    throw new Error(await buildUpstreamError("speech", response))
  }
  const audio = await response.arrayBuffer()
  if (audio.byteLength === 0) {
    throw new Error("speech test failed: empty audio")
  }
}

async function ensureLanguageTestPassed(response: Response) {
  if (!response.ok) {
    throw new Error(await buildUpstreamError("language", response))
  }
  const data = await response.json().catch(() => null)
  const content = String(data?.choices?.[0]?.message?.content ?? "").trim()
  if (!content) {
    throw new Error("language test failed: empty response")
  }
}

/** 测试模型连通性的核心逻辑，复用于两个 test 接口 */
async function runModelTest(
  baseUrl: string,
  apiKey: string,
  modelName: string,
  category: ModelCategory
): Promise<{ success: boolean; error?: string }> {
  try {
    const base = baseUrl.replace(/\/$/, "")
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    }
    if (category === "embedding") {
      const resp = await fetch(`${base}/embeddings`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: modelName, input: "hello" })
      })
      await ensureEmbeddingTestPassed(resp)
    } else if (category === "speech") {
      const resp = await fetch(`${base}/audio/speech`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: modelName, input: "hello", voice: "alloy" })
      })
      await ensureSpeechTestPassed(resp)
    } else {
      const resp = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: modelName, messages: [{ role: "user", content: "hello" }] })
      })
      await ensureLanguageTestPassed(resp)
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "连通失败"
    }
  }
}

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
  const body = await c.req.json()
  const payload = modelSchema.parse({ ...body, id: c.req.param("id") })
  const item = repository.saveModelConfig(c.get("userId"), payload)
  return c.json({ item })
})

app.delete("/models/:id", (c) => {
  repository.deleteModelConfig(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

/** 使用表单数据测试连通性（新增模型时使用） */
app.post("/models/test", async (c) => {
  const payload = modelSchema.parse(await c.req.json())
  if (!payload.baseUrl || !payload.modelName) {
    return c.json({ success: false, error: "配置不完整" }, 400)
  }
  const result = await runModelTest(
    payload.baseUrl,
    payload.apiKey,
    payload.modelName,
    payload.category
  )
  return result.success ? c.json(result) : c.json(result, 400)
})

/** 使用已存储的模型数据测试连通性 */
app.post("/models/:id/test", async (c) => {
  const userId = c.get("userId")
  const modelId = c.req.param("id")
  const model = repository.listModelConfigs(userId).find((m) => m.id === modelId)
  if (!model) {
    return c.json({ success: false, error: "模型不存在" }, 404)
  }
  if (!model.baseUrl || !model.modelName) {
    return c.json({ success: false, error: "模型配置不完整" }, 400)
  }
  const result = await runModelTest(
    model.baseUrl,
    decryptValue(model.apiKey),
    model.modelName,
    model.category
  )
  return result.success ? c.json(result) : c.json(result, 400)
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
      navigationMode: z.enum(["horizontal", "vertical"]),
      translationView: z.enum(["original", "translation"]),
      highlightShortcuts: z.object({
        yellow: z.string().min(1).max(20),
        green: z.string().min(1).max(20),
        blue: z.string().min(1).max(20),
        pink: z.string().min(1).max(20),
        note: z.string().min(1).max(20)
      }).optional()
    })
    .parse(await c.req.json())
  const item = repository.updateReaderSettings(c.get("userId"), payload)
  return c.json({ item })
})

app.get("/archive", (c) => {
  const user = repository.getUserById(c.get("userId"))
  return c.json({
    item: {
      archiveRetentionDays: user?.archiveRetentionDays ?? 30,
      autoArchiveAfterDays: user?.autoArchiveAfterDays ?? 3
    }
  })
})

app.put("/archive", async (c) => {
  const payload = z
    .object({
      archiveRetentionDays: z.number().int().min(0).max(365).optional(),
      autoArchiveAfterDays: z.number().int().min(0).max(365).optional()
    })
    .parse(await c.req.json())
  const user = repository.updateUser(c.get("userId"), payload)
  return c.json({ item: user })
})

export default app
