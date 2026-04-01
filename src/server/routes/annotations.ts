/**
 * 批注路由
 * 支持划词批注和对话式批注，管理批注队列和 AI 配置
 *
 * @author Anner
 * @since 0.2.0
 * Created on 2026/3/24
 */
import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"
import { invalidateAnnotations } from "@/src/server/repositories/cached"
import { processAnnotation } from "@/src/server/services/annotation/processor"

const app = new Hono<AppEnv>()

/** 获取批注 AI 配置（必须在 /:viewpointId 之前匹配） */
app.get("/config/ai", (c) => {
  const config = repository.getAnnotationConfig(c.get("userId"))
  return c.json({
    item: config ?? {
      systemPrompt: "",
      autoProcess: true
    }
  })
})

/** 保存批注 AI 配置 */
app.put("/config/ai", async (c) => {
  const payload = z
    .object({
      systemPrompt: z.string(),
      autoProcess: z.boolean()
    })
    .parse(await c.req.json())

  const userId = c.get("userId")
  const item = repository.saveAnnotationConfig(userId, payload)
  void invalidateAnnotations(userId)
  return c.json({ item })
})

/** 获取某个观点下的全部批注 */
app.get("/:viewpointId", (c) => {
  const items = repository.listAnnotations(
    c.get("userId"),
    c.req.param("viewpointId")
  )
  return c.json({ items })
})

/** 提交新批注（划词或对话） */
app.post("/:viewpointId", async (c) => {
  const payload = z
    .object({
      mode: z.enum(["selection", "chat"]),
      targetBlockId: z.string().optional(),
      targetText: z.string().optional(),
      comment: z.string().min(1)
    })
    .parse(await c.req.json())

  const userId = c.get("userId")
  const viewpointId = c.req.param("viewpointId")

  const annotation = repository.createAnnotation({
    userId,
    viewpointId,
    mode: payload.mode,
    targetBlockId: payload.targetBlockId,
    targetText: payload.targetText,
    comment: payload.comment
  })

  // 检查是否自动处理
  const config = repository.getAnnotationConfig(userId)
  if (config?.autoProcess !== false) {
    // 异步处理，不阻塞响应
    void processAnnotation(userId, annotation.id)
  }

  void invalidateAnnotations(userId)
  return c.json({ item: annotation })
})

/** 手动触发批注处理 */
app.post("/:viewpointId/:annotationId/process", async (c) => {
  const userId = c.get("userId")
  const annotationId = c.req.param("annotationId")

  void processAnnotation(userId, annotationId)

  return c.json({ ok: true, message: "批注已加入处理队列" })
})

export default app
