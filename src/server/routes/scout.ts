/**
 * Scout 路由
 * 管理信息源、抓取任务、审批 Patch、渠道与凭证
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import { BUILTIN_CHANNELS } from "@/src/server/services/scout/builtin-channels"
import { fetchRss } from "@/src/server/services/scout/rss-fetcher"
import { randomUUID } from "node:crypto"

const app = new Hono<AppEnv>()

// ─── 渠道 ───

/** 获取所有渠道（内置 + 用户自定义） */
app.get("/channels", (c) => {
  const userChannels = repository.listChannels(c.get("userId"))
  const builtinWithIds = BUILTIN_CHANNELS.map((ch) => ({
    ...ch,
    id: `builtin-${ch.name.replace(/\s+/g, "-").toLowerCase()}`,
    createdAt: ""
  }))
  /** 合并内置渠道和数据库中的用户渠道 */
  const all = [...builtinWithIds, ...userChannels.filter((ch) => ch.origin === "user")]
  return c.json({ items: all })
})

/** 创建自定义渠道 */
app.post("/channels", async (c) => {
  const payload = z.object({
    name: z.string().min(1),
    description: z.string(),
    icon: z.string(),
    protocol: z.enum(["rss", "x_api", "webpage", "newsletter"]),
    tags: z.array(z.string()),
    endpointTemplate: z.string(),
    params: z.array(z.object({
      name: z.string(),
      label: z.string(),
      placeholder: z.string(),
      required: z.boolean(),
      inputType: z.enum(["text", "select"]),
      options: z.array(z.object({ label: z.string(), value: z.string() })).optional()
    })),
    defaultFetchCron: z.string(),
    requiresCredential: z.boolean(),
    credentialType: z.string().optional()
  }).parse(await c.req.json())

  const item = repository.createChannel(c.get("userId"), {
    ...payload,
    origin: "user"
  })
  return c.json({ item }, 201)
})

/** 更新自定义渠道 */
app.put("/channels/:id", async (c) => {
  const payload = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    endpointTemplate: z.string().optional(),
    params: z.array(z.any()).optional(),
    defaultFetchCron: z.string().optional()
  }).parse(await c.req.json())

  const item = repository.updateChannel(c.get("userId"), c.req.param("id"), payload)
  if (!item) {
    return c.json({ error: "Channel not found or not editable" }, 404)
  }
  return c.json({ item })
})

/** 删除自定义渠道 */
app.delete("/channels/:id", (c) => {
  repository.deleteChannel(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

// ─── 凭证 ───

app.get("/credentials", (c) => {
  const items = repository.listCredentials(c.get("userId")).map((cred) => ({
    ...cred,
    credentials: Object.fromEntries(Object.keys(cred.credentials).map((k) => [k, "***"]))
  }))
  return c.json({ items })
})

app.post("/credentials", async (c) => {
  const payload = z.object({
    type: z.string(),
    name: z.string().min(1),
    credentials: z.record(z.string())
  }).parse(await c.req.json())

  const item = repository.createCredential(c.get("userId"), payload)
  return c.json({ item }, 201)
})

app.put("/credentials/:id", async (c) => {
  const payload = z.object({
    name: z.string().optional(),
    credentials: z.record(z.string()).optional()
  }).parse(await c.req.json())

  const item = repository.updateCredential(c.get("userId"), c.req.param("id"), payload)
  if (!item) {
    return c.json({ error: "Credential not found" }, 404)
  }
  return c.json({ item })
})

app.delete("/credentials/:id", (c) => {
  repository.deleteCredential(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

/** 验证凭证（标记为已验证） */
app.post("/credentials/:id/verify", (c) => {
  const item = repository.updateCredential(c.get("userId"), c.req.param("id"), {
    verified: true,
    lastVerifiedAt: new Date().toISOString()
  })
  if (!item) {
    return c.json({ error: "Credential not found" }, 404)
  }
  return c.json({ item })
})

// ─── 信息源 ───

app.get("/sources", (c) => {
  const items = repository.listSources(c.get("userId"))
  return c.json({ items })
})

app.post("/sources", async (c) => {
  const payload = z.object({
    name: z.string().min(1),
    channelId: z.string(),
    protocol: z.enum(["rss", "x_api", "webpage", "newsletter"]),
    endpoint: z.string(),
    paramValues: z.record(z.string()),
    status: z.enum(["active", "paused"]).default("active"),
    includeKeywords: z.array(z.string()).default([]),
    excludeKeywords: z.array(z.string()).default([]),
    language: z.string().optional()
  }).parse(await c.req.json())

  const item = repository.createSource(c.get("userId"), payload)
  return c.json({ item }, 201)
})

app.put("/sources/:id", async (c) => {
  const payload = z.object({
    name: z.string().optional(),
    status: z.enum(["active", "paused", "error"]).optional(),
    includeKeywords: z.array(z.string()).optional(),
    excludeKeywords: z.array(z.string()).optional(),
    language: z.string().optional()
  }).parse(await c.req.json())

  const item = repository.updateSource(c.get("userId"), c.req.param("id"), payload)
  if (!item) {
    return c.json({ error: "Source not found" }, 404)
  }
  return c.json({ item })
})

app.delete("/sources/:id", (c) => {
  repository.deleteSource(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

/** 创建前预测试连接（无需 sourceId，静态路由先注册） */
app.post("/sources/test", async (c) => {
  const { protocol, endpoint } = z.object({
    protocol: z.enum(["rss", "x_api", "webpage", "newsletter"]),
    endpoint: z.string().min(1)
  }).parse(await c.req.json())
  return c.json(await testConnection(protocol, endpoint))
})

/** 测试已创建的信息源连接 */
app.post("/sources/:id/test", async (c) => {
  const source = repository.getSource(c.get("userId"), c.req.param("id"))
  if (!source) {
    return c.json({ ok: false, error: "Source not found" }, 404)
  }
  return c.json(await testConnection(source.protocol, source.endpoint))
})

// ─── 任务 ───

app.get("/tasks", (c) => {
  const items = repository.listTasks(c.get("userId"))
  return c.json({ items })
})

app.get("/tasks/:id", (c) => {
  const item = repository.getTask(c.get("userId"), c.req.param("id"))
  if (!item) {
    return c.json({ error: "Task not found" }, 404)
  }
  return c.json({ item })
})

app.post("/tasks", async (c) => {
  const payload = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    status: z.enum(["active", "paused"]).default("active"),
    sourceIds: z.array(z.string()),
    scheduleCron: z.string().optional(),
    scopeViewpointIds: z.array(z.string()),
    relevanceThreshold: z.number().min(0).max(1).default(0.6),
    maxPatchesPerRun: z.number().int().min(1).default(20)
  }).parse(await c.req.json())

  const item = repository.createTask(c.get("userId"), payload)
  return c.json({ item }, 201)
})

app.put("/tasks/:id", async (c) => {
  const payload = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    sourceIds: z.array(z.string()).optional(),
    scheduleCron: z.string().optional(),
    scopeViewpointIds: z.array(z.string()).optional(),
    relevanceThreshold: z.number().optional(),
    maxPatchesPerRun: z.number().optional()
  }).parse(await c.req.json())

  const item = repository.updateTask(c.get("userId"), c.req.param("id"), payload)
  if (!item) {
    return c.json({ error: "Task not found" }, 404)
  }
  return c.json({ item })
})

/** 切换任务状态 */
app.post("/tasks/:id/toggle", (c) => {
  const userId = c.get("userId")
  const task = repository.getTask(userId, c.req.param("id"))
  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }
  const item = repository.updateTask(userId, task.id, {
    status: task.status === "active" ? "paused" : "active"
  })
  return c.json({ item })
})

/** 手动触发任务执行 */
app.post("/tasks/:id/run", async (c) => {
  const userId = c.get("userId")
  const task = repository.getTask(userId, c.req.param("id"))
  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }

  const job = repository.createJob({
    userId,
    taskId: task.id,
    sourceIds: task.sourceIds,
    triggeredBy: "manual",
    status: "running",
    stages: {
      fetch: { total: 0, completed: 0, errors: 0 },
      analyze: { total: 0, completed: 0, errors: 0 },
      patch: { total: 0, generated: 0 }
    },
    startedAt: new Date().toISOString()
  })

  // 异步执行管线（Phase 1-3 仅做 RSS 抓取，不做 AI 分析）
  void import("@/src/server/services/scout/pipeline").then((m) =>
    m.runPipeline(userId, task, job.id).catch(() => {})
  )

  return c.json({ item: job })
})

app.delete("/tasks/:id", (c) => {
  repository.deleteTask(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

// ─── 条目 ───

app.get("/entries", (c) => {
  const { sourceId, taskId } = c.req.query()
  const items = repository.listEntries(c.get("userId"), sourceId, taskId)
  return c.json({ items })
})

app.get("/entries/:id", (c) => {
  const item = repository.getEntry(c.get("userId"), c.req.param("id"))
  if (!item) {
    return c.json({ error: "Entry not found" }, 404)
  }
  return c.json({ item })
})

app.delete("/entries/:id", (c) => {
  repository.deleteEntry(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

// ─── Patch ───

app.get("/patches", (c) => {
  const { taskId, status } = c.req.query()
  const items = repository.listPatches(
    c.get("userId"),
    taskId,
    status as any
  )
  return c.json({ items })
})

app.get("/patches/:id", (c) => {
  const item = repository.getPatch(c.get("userId"), c.req.param("id"))
  if (!item) {
    return c.json({ error: "Patch not found" }, 404)
  }
  return c.json({ item })
})

/** 批准 Patch → 合并到知识库 */
app.post("/patches/:id/approve", async (c) => {
  const userId = c.get("userId")
  const patch = repository.getPatch(userId, c.req.param("id"))
  if (!patch) {
    return c.json({ error: "Patch not found" }, 404)
  }
  if (patch.status !== "pending" && patch.status !== "expanding") {
    return c.json({ error: "Patch is not in approvable state" }, 400)
  }

  /** 合并 suggestedBlocks 到目标观点 */
  const viewpoint = repository.getViewpoint(userId, patch.targetViewpointId)
  if (!viewpoint) {
    return c.json({ error: "Target viewpoint not found" }, 404)
  }

  const existingBlocks = viewpoint.articleBlocks ?? []
  const maxOrder = existingBlocks.reduce((max, b) => Math.max(max, b.sortOrder), -1)

  /** 为 suggestedBlocks 添加 sourceRef 并重排序号 */
  const newBlocks = patch.suggestedBlocks.map((block, i) => ({
    ...block,
    id: randomUUID(),
    sortOrder: maxOrder + 1 + i,
    sourceRef: {
      type: "scout" as const,
      patchId: patch.id,
      sourceUrl: patch.sourceSnapshot.url,
      author: patch.sourceSnapshot.author,
      fetchedAt: patch.createdAt
    }
  }))

  const insertIdx = patch.insertAfterBlockId
    ? existingBlocks.findIndex((b) => b.id === patch.insertAfterBlockId) + 1
    : existingBlocks.length

  const merged = [
    ...existingBlocks.slice(0, insertIdx),
    ...newBlocks,
    ...existingBlocks.slice(insertIdx)
  ]

  repository.updateViewpointBlocks(userId, patch.targetViewpointId, merged)
  repository.updatePatch(userId, patch.id, {
    status: "merged",
    mergedAt: new Date().toISOString()
  })

  return c.json({ ok: true })
})

/** 拒绝 Patch */
app.post("/patches/:id/reject", async (c) => {
  const payload = z.object({
    reviewNote: z.string().optional()
  }).parse(await c.req.json())

  const item = repository.updatePatch(c.get("userId"), c.req.param("id"), {
    status: "rejected",
    reviewNote: payload.reviewNote
  })
  if (!item) {
    return c.json({ error: "Patch not found" }, 404)
  }
  return c.json({ item })
})

/** 追问展开 Patch */
app.post("/patches/:id/expand", async (c) => {
  const payload = z.object({
    message: z.string().min(1)
  }).parse(await c.req.json())

  const userId = c.get("userId")
  const patch = repository.getPatch(userId, c.req.param("id"))
  if (!patch) {
    return c.json({ error: "Patch not found" }, 404)
  }

  const thread = patch.thread ?? []
  thread.push({
    id: randomUUID(),
    role: "user",
    content: payload.message,
    createdAt: new Date().toISOString()
  })

  const item = repository.updatePatch(userId, patch.id, {
    status: "expanding",
    thread
  })

  return c.json({ item })
})

/** 修改 Patch 目标观点 */
app.put("/patches/:id/target", async (c) => {
  const payload = z.object({
    targetViewpointId: z.string(),
    targetViewpointTitle: z.string()
  }).parse(await c.req.json())

  const item = repository.updatePatch(c.get("userId"), c.req.param("id"), payload)
  if (!item) {
    return c.json({ error: "Patch not found" }, 404)
  }
  return c.json({ item })
})

// ─── Job ───

app.get("/jobs", (c) => {
  const { taskId } = c.req.query()
  const items = repository.listJobs(c.get("userId"), taskId)
  return c.json({ items })
})

app.get("/jobs/:id", (c) => {
  const item = repository.getJob(c.get("userId"), c.req.param("id"))
  if (!item) {
    return c.json({ error: "Job not found" }, 404)
  }
  return c.json({ item })
})

// ─── 全局配置 ───

app.get("/config", (c) => {
  const item = repository.getScoutConfig(c.get("userId"))
  return c.json({
    item: item ?? {
      enabled: false,
      defaultRelevanceThreshold: 0.6,
      dailyPatchLimit: 50,
      entryRetentionDays: 30
    }
  })
})

app.put("/config", async (c) => {
  const payload = z.object({
    enabled: z.boolean(),
    defaultRelevanceThreshold: z.number().min(0).max(1),
    dailyPatchLimit: z.number().int().min(1),
    entryRetentionDays: z.number().int().min(1),
    rsshubBaseUrl: z.string().optional()
  }).parse(await c.req.json())

  const item = repository.saveScoutConfig(c.get("userId"), payload)
  return c.json({ item })
})

// ─── 工具函数 ───

async function testConnection(
  protocol: string,
  endpoint: string
): Promise<{ ok: boolean; sampleTitles?: string[]; error?: string }> {
  try {
    if (protocol === "rss") {
      const items = await fetchRss(endpoint)
      return {
        ok: true,
        sampleTitles: items.slice(0, 3).map((item) => item.title)
      }
    }
    // 其他协议暂返回占位
    return { ok: false, error: `协议 ${protocol} 暂不支持测试` }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "连接失败" }
  }
}

export default app
