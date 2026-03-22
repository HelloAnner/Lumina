import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import { exportTaskAsPdf } from "@/src/server/services/publish/service"

const app = new Hono<AppEnv>()

app.get("/tree", (c) => {
  return c.json({ items: repository.listViewpoints(c.get("userId")) })
})

app.post("/", async (c) => {
  const payload = z
    .object({
      title: z.string().min(1),
      parentId: z.string().optional(),
      isFolder: z.boolean().default(false)
    })
    .parse(await c.req.json())
  const item = repository.createViewpoint({
    userId: c.get("userId"),
    title: payload.title,
    parentId: payload.parentId,
    isFolder: payload.isFolder,
    isCandidate: false,
    sortOrder: repository.listViewpoints(c.get("userId")).length + 1,
    articleContent: "",
    relatedBookIds: []
  })
  return c.json({ item })
})

app.get("/:id", (c) => {
  const item = repository.getViewpoint(c.get("userId"), c.req.param("id"))
  if (!item) {
    return c.json({ error: "观点不存在" }, 404)
  }
  return c.json({ item })
})

app.put("/:id", async (c) => {
  const payload = z
    .object({
      title: z.string().optional(),
      parentId: z.string().optional(),
      sortOrder: z.number().optional()
    })
    .parse(await c.req.json())
  const item = repository.updateViewpoint(
    c.get("userId"),
    c.req.param("id"),
    payload
  )
  return c.json({ item })
})

app.delete("/:id", (c) => {
  repository.deleteViewpoint(c.get("userId"), c.req.param("id"))
  return c.json({ ok: true })
})

app.put("/:id/article", async (c) => {
  const payload = z.object({ articleContent: z.string() }).parse(await c.req.json())
  const item = repository.updateViewpoint(c.get("userId"), c.req.param("id"), {
    articleContent: payload.articleContent,
    lastSynthesizedAt: new Date().toISOString()
  })
  return c.json({ item })
})

app.get("/:id/highlights", (c) => {
  const viewpointId = c.req.param("id")
  const items = repository
    .listUnconfirmedHighlights(c.get("userId"), viewpointId)
    .concat([])
  return c.json({ items })
})

app.get("/:id/related", (c) => {
  return c.json({
    items: repository.listRelatedViewpoints(c.get("userId"), c.req.param("id"))
  })
})

app.post("/:id/send-email", (c) => {
  return c.json({
    ok: true,
    message: "当前版本使用本地模拟发送，邮件发送服务可继续替换。"
  })
})

app.get("/:id/export", async (c) => {
  const item = repository.getViewpoint(c.get("userId"), c.req.param("id"))
  if (!item) {
    return c.json({ error: "观点不存在" }, 404)
  }
  const format = c.req.query("format") ?? "markdown"
  if (format === "pdf") {
    const buffer = await exportTaskAsPdf(item.articleContent)
    c.header("Content-Type", "application/pdf")
    c.header(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(item.title)}.pdf"`
    )
    return c.body(new Uint8Array(buffer))
  }
  c.header("Content-Type", "text/markdown; charset=utf-8")
  c.header(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(item.title)}.md"`
  )
  return c.body(item.articleContent)
})

export default app
