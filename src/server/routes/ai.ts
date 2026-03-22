import { Hono } from "hono"
import { z } from "zod"
import { decryptValue } from "@/src/server/lib/crypto"
import type { AppEnv } from "@/src/server/lib/hono"
import { repository } from "@/src/server/repositories"

const app = new Hono<AppEnv>()

app.post("/explain", async (c) => {
  const payload = z
    .object({
      content: z.string().min(1),
      context: z.string().optional()
    })
    .parse(await c.req.json())

  const config = repository
    .getModelByFeature(c.get("userId"), "instant_explain")

  if (config?.baseUrl && config.apiKey && config.modelName !== "未配置") {
    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${decryptValue(config.apiKey)}`
        },
        body: JSON.stringify({
          model: config.modelName,
          messages: [
            {
              role: "user",
              content: `请对以下文字进行深度解析和扩展：\n${payload.content}\n\n上下文：${payload.context ?? "无"}`
            }
          ],
          stream: false
        })
      })
      const data = await response.json()
      const text = data.choices?.[0]?.message?.content ?? "未获取到模型输出。"
      return c.json({ text, source: "model" })
    } catch {
      return c.json({
        text: `模型调用失败，已降级为本地解释：\n\n这段内容的核心在于“${payload.content.slice(
          0,
          18
        )}...”，它强调了从原理、反馈或长期积累去理解问题。`,
        source: "fallback"
      })
    }
  }

  return c.json({
    text: `当前未配置解释模型。\n\n本地解释：这段内容强调“${payload.content.slice(
      0,
      18
    )}...”，建议把它放回所在章节与个人批注一起看，通常能更快找到作者真正想表达的因果关系。`,
    source: "local"
  })
})

export default app
