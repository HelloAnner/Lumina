/**
 * 导入模块 API 路由
 * 管理导入来源、导入任务、导入笔记和笔记-观点关联
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
import { Hono } from "hono"
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import { cancelImportJob } from "@/src/server/services/import/pipeline"

const DATA_DIR = process.env.DATA_DIR ?? "data/app"

const app = new Hono<AppEnv>()

// ─── 导入来源 ───

/** 列出导入来源 */
app.get("/sources", (c) => {
  const userId = c.get("userId")
  const sources = repository.listImportSources(userId)

  // 附加统计信息
  const enriched = sources.map((source) => {
    const notes = repository.listImportedNotes(userId, source.id)
    const imageCount = notes.reduce((sum, n) => sum + n.imageKeys.length, 0)
    const links = notes.flatMap((n) => repository.listNoteViewpointLinks(n.id))
    const viewpointIds = new Set(links.map((l) => l.viewpointId))

    return {
      ...source,
      stats: {
        noteCount: notes.length,
        imageCount,
        viewpointCount: viewpointIds.size
      }
    }
  })

  return c.json({ items: enriched })
})

/** 新建导入来源 */
app.post("/sources", async (c) => {
  const userId = c.get("userId")
  const body = await c.req.json()

  const schema = z.object({
    name: z.string().min(1),
    path: z.string().min(1),
    excludePatterns: z.array(z.string()).default([])
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400)
  }

  const { name, path, excludePatterns } = parsed.data

  // 校验路径
  if (!existsSync(path)) {
    return c.json({ error: "Path does not exist" }, 400)
  }
  const stat = statSync(path)
  if (!stat.isDirectory()) {
    return c.json({ error: "Path is not a directory" }, 400)
  }

  const source = repository.createImportSource({
    userId,
    type: "obsidian",
    name,
    path,
    excludePatterns
  })

  return c.json({ item: source }, 201)
})

/** 通过浏览器上传 Vault 文件夹创建导入来源 */
app.post("/sources/upload", async (c) => {
  const userId = c.get("userId")
  const form = await c.req.formData()

  const name = (form.get("name") as string)?.trim()
  if (!name) {
    return c.json({ error: "名称不能为空" }, 400)
  }

  const excludePatterns: string[] = JSON.parse(
    (form.get("excludePatterns") as string) || "[]"
  )
  const relativePaths: string[] = JSON.parse(
    (form.get("relativePaths") as string) || "[]"
  )
  const files = form.getAll("files") as File[]

  if (files.length === 0 || relativePaths.length !== files.length) {
    return c.json({ error: "未选择文件或路径信息缺失" }, 400)
  }

  // 创建 source 获取 ID，再写文件到对应目录
  const source = repository.createImportSource({
    userId,
    type: "obsidian",
    name,
    path: "", // 占位，写完文件后回填
    excludePatterns
  })

  const vaultDir = join(DATA_DIR, "vaults", source.id)

  for (let i = 0; i < files.length; i++) {
    const relPath = relativePaths[i]
    if (!relPath || relPath.includes("..")) {
      continue
    }
    const targetPath = join(vaultDir, relPath)
    mkdirSync(dirname(targetPath), { recursive: true })
    const buffer = Buffer.from(await files[i].arrayBuffer())
    writeFileSync(targetPath, buffer)
  }

  // 回填实际路径
  repository.updateImportSource(userId, source.id, { path: vaultDir })

  // 自动触发同步
  const job = repository.createImportJob({
    userId,
    sourceId: source.id,
    status: "pending",
    stage: "scanning",
    progress: { totalFiles: 0, totalImages: 0, processed: 0, total: 0 },
    startedAt: new Date().toISOString()
  })

  void import("@/src/server/services/import/pipeline").then((m) =>
    m.runImportPipeline(userId, job.id)
  )

  return c.json({ item: source, job }, 201)
})

/** 更新导入来源 */
app.put("/sources/:id", async (c) => {
  const userId = c.get("userId")
  const { id } = c.req.param()
  const body = await c.req.json()

  const source = repository.updateImportSource(userId, id, body)
  if (!source) {
    return c.json({ error: "Source not found" }, 404)
  }
  return c.json({ item: source })
})

/** 删除导入来源（级联清理） */
app.delete("/sources/:id", (c) => {
  const userId = c.get("userId")
  const { id } = c.req.param()

  const source = repository.getImportSource(userId, id)
  if (!source) {
    return c.json({ error: "Source not found" }, 404)
  }

  repository.deleteImportSource(userId, id)
  return c.json({ success: true })
})

/** 触发同步 */
app.post("/sources/:id/sync", (c) => {
  const userId = c.get("userId")
  const { id } = c.req.param()

  const source = repository.getImportSource(userId, id)
  if (!source) {
    return c.json({ error: "Source not found" }, 404)
  }

  // 检查是否已有进行中的任务
  if (repository.hasRunningImportJob(userId, id)) {
    return c.json({ error: "Import already running for this source" }, 409)
  }

  const job = repository.createImportJob({
    userId,
    sourceId: id,
    status: "pending",
    stage: "scanning",
    progress: {
      totalFiles: 0,
      totalImages: 0,
      processed: 0,
      total: 0
    },
    startedAt: new Date().toISOString()
  })

  // 异步启动管线
  void import("@/src/server/services/import/pipeline").then((m) =>
    m.runImportPipeline(userId, job.id)
  )

  return c.json({ item: job }, 201)
})

// ─── 导入任务 ───

/** 列出导入任务 */
app.get("/jobs", (c) => {
  const userId = c.get("userId")
  const sourceId = c.req.query("sourceId")
  const jobs = repository.listImportJobs(userId, sourceId)
  return c.json({ items: jobs })
})

/** 查询导入任务状态 */
app.get("/jobs/:id", (c) => {
  const userId = c.get("userId")
  const { id } = c.req.param()
  const job = repository.getImportJob(userId, id)
  if (!job) {
    return c.json({ error: "Job not found" }, 404)
  }
  return c.json({ item: job })
})

/** 取消导入任务 */
app.post("/jobs/:id/cancel", (c) => {
  const userId = c.get("userId")
  const { id } = c.req.param()
  const job = repository.getImportJob(userId, id)
  if (!job) {
    return c.json({ error: "Job not found" }, 404)
  }
  if (job.status !== "running") {
    return c.json({ error: "Job is not running" }, 400)
  }
  cancelImportJob(id)
  return c.json({ success: true })
})

// ─── 导入笔记 ───

/** 列出导入笔记 */
app.get("/notes", (c) => {
  const userId = c.get("userId")
  const sourceId = c.req.query("sourceId")
  const notes = repository.listImportedNotes(userId, sourceId)

  // 返回精简列表（不含完整 blocks 和 rawMarkdown）
  const items = notes.map((n) => ({
    id: n.id,
    sourceId: n.sourceId,
    relativePath: n.relativePath,
    title: n.title,
    tags: n.tags,
    imageKeys: n.imageKeys,
    importedAt: n.importedAt
  }))
  return c.json({ items })
})

/** 查看笔记详情 */
app.get("/notes/:id", (c) => {
  const userId = c.get("userId")
  const { id } = c.req.param()
  const note = repository.getImportedNote(userId, id)
  if (!note) {
    return c.json({ error: "Note not found" }, 404)
  }
  return c.json({ item: note })
})

/** 查看笔记关联的观点 */
app.get("/notes/:id/viewpoints", (c) => {
  const userId = c.get("userId")
  const { id } = c.req.param()
  const note = repository.getImportedNote(userId, id)
  if (!note) {
    return c.json({ error: "Note not found" }, 404)
  }
  const links = repository.listNoteViewpointLinks(id)
  return c.json({ items: links })
})

/** 确认/取消笔记-观点关联 */
app.put("/links/:noteId/:viewpointId", async (c) => {
  const { noteId, viewpointId } = c.req.param()
  const body = await c.req.json()
  const link = repository.updateNoteViewpointLink(noteId, viewpointId, body)
  if (!link) {
    return c.json({ error: "Link not found" }, 404)
  }
  return c.json({ item: link })
})

/** 代理访问 MinIO 图片 */
app.get("/images/*", async (c) => {
  const userId = c.get("userId")
  const key = c.req.path.replace("/api/import/images/", "")

  // 校验 key 对应的 source 归属
  const parts = key.match(/^imports\/([^/]+)\//)
  if (!parts) {
    return c.json({ error: "Invalid image key" }, 400)
  }
  const sourceId = parts[1]
  const source = repository.getImportSource(userId, sourceId)
  if (!source) {
    return c.json({ error: "Unauthorized" }, 403)
  }

  // 本期返回 404（MinIO 集成在后续迭代中完善）
  return c.json({ error: "Image proxy not yet implemented" }, 501)
})

export default app
