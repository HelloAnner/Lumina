/**
 * 批注处理器
 * 接收用户批注，调用 AI 模型重新编辑笔记块
 *
 * @author Anner
 * @since 0.2.0
 * Created on 2026/3/24
 */
import { decryptValue } from "@/src/server/lib/crypto"
import { repository } from "@/src/server/repositories"
import type { NoteBlock } from "@/src/server/store/types"

const DEFAULT_SYSTEM_PROMPT = [
  "你是一个专业的知识笔记编辑助手。",
  "用户会对笔记中的某段文字或整篇笔记提出修改意见（批注），你需要根据批注内容重新编辑笔记。",
  "",
  "规则：",
  "1. 保持笔记的整体结构和风格不变",
  "2. 仅修改批注指向的内容，不要改动其他部分",
  "3. 如果批注要求补充内容，在合适的位置插入新的块",
  "4. 只输出 JSON，格式为 {\"blocks\": [...]}，blocks 是完整的笔记块数组",
  "5. 每个块必须包含 id、type、sortOrder 字段",
  "6. 支持的块类型：heading, paragraph, quote, highlight, insight, code, divider, chart"
].join("\n")

/** 构建发送给 AI 的用户消息 */
function buildUserMessage(
  blocks: NoteBlock[],
  comment: string,
  targetBlockId?: string,
  targetText?: string
) {
  const parts: string[] = []
  parts.push("当前笔记内容（JSON 块数组）：")
  parts.push("```json")
  parts.push(JSON.stringify(blocks, null, 2))
  parts.push("```")
  parts.push("")

  if (targetBlockId) {
    parts.push(`批注指向的块 ID：${targetBlockId}`)
  }
  if (targetText) {
    parts.push(`批注选中的原文：「${targetText}」`)
  }
  parts.push(`用户批注：${comment}`)
  parts.push("")
  parts.push("请根据批注修改笔记，输出完整的 blocks JSON。")

  return parts.join("\n")
}

/** 从 AI 返回内容中解析 blocks */
function parseBlocksFromResponse(content: string): NoteBlock[] {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i)
  const jsonText = fenced?.[1]?.trim() ?? content.trim()

  const objectMatch = jsonText.match(/\{[\s\S]*\}/)
  if (!objectMatch) {
    throw new Error("AI 返回内容无法解析为 JSON")
  }

  const parsed = JSON.parse(objectMatch[0]) as { blocks?: NoteBlock[] }
  if (!Array.isArray(parsed.blocks)) {
    throw new Error("AI 返回的 JSON 中没有 blocks 数组")
  }

  return parsed.blocks
}

/**
 * 处理单条批注
 * 调用绑定的 annotation_rewrite 模型执行编辑
 */
export async function processAnnotation(
  userId: string,
  annotationId: string
) {
  // 标记为处理中
  repository.updateAnnotation(userId, annotationId, {
    status: "processing"
  })

  try {
    const annotations = repository.listPendingAnnotations(userId)
    const annotation = annotations.find((a) => a.id === annotationId)
    if (!annotation) {
      throw new Error("Annotation not found")
    }

    const viewpoint = repository.getViewpoint(userId, annotation.viewpointId)
    if (!viewpoint) {
      throw new Error("Viewpoint not found")
    }

    // 获取模型配置
    const model = repository.getModelByFeature(userId, "annotation_rewrite")
    if (!model) {
      throw new Error("未配置批注处理模型，请在设置中绑定 annotation_rewrite 功能的模型")
    }

    // 获取批注 AI 配置
    const annoConfig = repository.getAnnotationConfig(userId)
    const systemPrompt = annoConfig?.systemPrompt || DEFAULT_SYSTEM_PROMPT

    // 获取当前块内容
    const currentBlocks = viewpoint.articleBlocks ?? []
    if (currentBlocks.length === 0) {
      throw new Error("当前观点没有笔记块内容")
    }

    // 构建请求
    const userMessage = buildUserMessage(
      currentBlocks,
      annotation.comment,
      annotation.targetBlockId,
      annotation.targetText
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
          { role: "user", content: userMessage }
        ],
        stream: false
      })
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Model API error ${response.status}: ${text.slice(0, 200)}`)
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content ?? ""
    if (!content) {
      throw new Error("模型返回内容为空")
    }

    // 解析并更新块
    const newBlocks = parseBlocksFromResponse(content)
    repository.updateViewpointBlocks(userId, annotation.viewpointId, newBlocks)

    // 标记完成
    repository.updateAnnotation(userId, annotationId, {
      status: "done",
      processedAt: new Date().toISOString()
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    repository.updateAnnotation(userId, annotationId, {
      status: "failed",
      errorMessage: message,
      processedAt: new Date().toISOString()
    })
  }
}
