/**
 * 笔记对话路由
 * 流式 SSE 代理，支持对块的针对性对话和新建块
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "@/src/server/lib/hono"
import { decryptValue } from "@/src/server/lib/crypto"
import { repository } from "@/src/server/repositories"
import { buildNoteChatSystemPrompt } from "@/src/server/services/note-chat/prompts"

const app = new Hono<AppEnv>()

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string()
    })
  ),
  blocks: z.array(z.any()),
  targetBlockId: z.string().optional(),
  actionHint: z.enum(["modify", "insert"]).optional()
})

/** 发送对话消息，流式返回 AI 响应 */
app.post("/:viewpointId", async (c) => {
  const userId = c.get("userId")
  const payload = chatRequestSchema.parse(await c.req.json())

  const model = repository.getModelByFeature(userId, "note_chat")
  if (!model) {
    return c.json(
      { error: "未配置笔记对话模型，请在设置中绑定 note_chat 功能的模型" },
      400
    )
  }

  const systemPrompt = buildNoteChatSystemPrompt(
    payload.blocks,
    payload.targetBlockId
  )

  const apiUrl = `${model.baseUrl.replace(/\/$/, "")}/chat/completions`
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${decryptValue(model.apiKey)}`
    },
    body: JSON.stringify({
      model: model.modelName,
      messages: [
        { role: "system", content: systemPrompt },
        ...payload.messages
      ],
      stream: true
    })
  })

  if (!response.ok) {
    const text = await response.text()
    return c.json(
      { error: `Model API error ${response.status}: ${text.slice(0, 200)}` },
      502
    )
  }

  // 透传 SSE 流
  return new Response(response.body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    }
  })
})

export default app
