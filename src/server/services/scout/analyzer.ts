/**
 * Scout 分析器
 * Phase 4: 将抓取条目与知识库观点匹配，生成 Patch
 *
 * 流程：
 * 1. 从条目中提取摘要
 * 2. 匹配目标观点（LLM 或文本降级）
 * 3. 生成建议的 NoteBlock
 * 4. 创建 ScoutPatch 记录
 *
 * @author Anner
 * @since 0.2.0
 */
import { randomUUID } from "node:crypto"
import { decryptValue } from "@/src/server/lib/crypto"
import { repository } from "@/src/server/repositories"
import type {
  ScoutEntry,
  ScoutTask,
  NoteBlock,
  ModelConfig,
  Viewpoint
} from "@/src/server/store/types"

/** 单次分析最多生成的 patch 数 */
const MAX_PATCHES_PER_ENTRY = 3

/**
 * 分析一批条目，匹配观点并生成 Patch
 * 返回生成的 patch 数量
 */
export async function analyzeEntries(
  userId: string,
  task: ScoutTask,
  entryIds: string[]
): Promise<number> {
  const model = resolveModel(userId)
  const viewpoints = resolveViewpoints(userId, task)
  if (viewpoints.length === 0) return 0

  let generated = 0

  for (const entryId of entryIds) {
    if (generated >= task.maxPatchesPerRun) break

    const entry = repository.getEntry(userId, entryId)
    if (!entry) continue

    try {
      const matches = model
        ? await matchByLLM(model, entry, viewpoints, task.relevanceThreshold)
        : matchByText(entry, viewpoints, task.relevanceThreshold)

      for (const match of matches.slice(0, MAX_PATCHES_PER_ENTRY)) {
        if (generated >= task.maxPatchesPerRun) break

        const blocks = model
          ? await generateBlocks(model, entry, match.viewpoint)
          : generateFallbackBlocks(entry)

        repository.createPatch({
          userId,
          entryId: entry.id,
          sourceId: entry.sourceId,
          taskId: task.id,
          targetViewpointId: match.viewpoint.id,
          targetViewpointTitle: match.viewpoint.title,
          status: "pending",
          relevanceScore: match.score,
          title: entry.title ?? "未命名条目",
          rationale: match.rationale,
          suggestedBlocks: blocks,
          sourceSnapshot: {
            url: entry.sourceUrl,
            title: entry.title,
            author: entry.author,
            publishedAt: entry.publishedAt,
            excerpt: (entry.content ?? "").slice(0, 300)
          }
        })

        generated++
      }

      repository.updateEntry(userId, entryId, { status: "matched" })
    } catch {
      repository.updateEntry(userId, entryId, { status: "discarded" })
    }
  }

  return generated
}

// ─── 模型解析 ───

function resolveModel(userId: string): ModelConfig | null {
  const featureOrder = ["scout_analyze", "aggregation_analyze", "article_generate", "instant_explain"] as const
  for (const feature of featureOrder) {
    const model = repository.getModelByFeature(userId, feature)
    if (model) return model
  }
  return null
}

function resolveViewpoints(userId: string, task: ScoutTask): Viewpoint[] {
  if (task.scopeViewpointIds.length > 0) {
    return task.scopeViewpointIds
      .map((id) => repository.getViewpoint(userId, id))
      .filter((v): v is Viewpoint => v != null && !v.isFolder)
  }
  return repository.listViewpoints(userId).filter((v) => !v.isFolder)
}

// ─── LLM 匹配 ───

interface MatchResult {
  viewpoint: Viewpoint
  score: number
  rationale: string
}

async function matchByLLM(
  model: ModelConfig,
  entry: ScoutEntry,
  viewpoints: Viewpoint[],
  threshold: number
): Promise<MatchResult[]> {
  const vpList = viewpoints.map((vp, i) => `${i + 1}. ${vp.title}`).join("\n")
  const content = (entry.content ?? "").slice(0, 1500)

  const prompt = [
    "你是知识库内容匹配助手。请分析以下信息源条目，判断它与哪些知识主题相关。",
    "",
    "输出 JSON 格式，每个匹配项包含 index（主题编号）、score（0-1 相关度）、rationale（一句话理由）。",
    "只输出真正相关的主题，score 低于 0.4 的不要输出。",
    '输出格式：{"matches":[{"index":1,"score":0.85,"rationale":"..."}]}',
    "如果无相关主题，输出：{\"matches\":[]}",
    "",
    `条目标题：${entry.title}`,
    `条目内容：${content}`,
    entry.author ? `作者：${entry.author}` : null,
    "",
    "已有知识主题列表：",
    vpList
  ].filter(Boolean).join("\n")

  const apiUrl = `${model.baseUrl.replace(/\/$/, "")}/chat/completions`
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${decryptValue(model.apiKey)}`
    },
    body: JSON.stringify({
      model: model.modelName,
      messages: [{ role: "user", content: prompt }],
      stream: false
    })
  })

  if (!response.ok) return []

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const answer = data.choices?.[0]?.message?.content?.trim() ?? ""

  try {
    const fenced = answer.match(/```json\s*([\s\S]*?)```/i)
    const jsonText = fenced?.[1]?.trim() ?? answer.trim()
    const objectMatch = jsonText.match(/\{[\s\S]*\}/)
    if (!objectMatch) return []

    const parsed = JSON.parse(objectMatch[0]) as {
      matches?: { index: number; score: number; rationale: string }[]
    }

    return (parsed.matches ?? [])
      .filter((m) => m.index >= 1 && m.index <= viewpoints.length && m.score >= threshold)
      .map((m) => ({
        viewpoint: viewpoints[m.index - 1],
        score: m.score,
        rationale: m.rationale
      }))
  } catch {
    return []
  }
}

// ─── 文本降级匹配 ───

function matchByText(
  entry: ScoutEntry,
  viewpoints: Viewpoint[],
  threshold: number
): MatchResult[] {
  const entryText = `${entry.title ?? ""} ${(entry.content ?? "").slice(0, 500)}`.toLowerCase()
  const results: MatchResult[] = []

  for (const vp of viewpoints) {
    const titleWords = vp.title.toLowerCase().split(/\s+/)
    const matched = titleWords.filter((w) => w.length > 1 && entryText.includes(w))
    const score = titleWords.length > 0 ? matched.length / titleWords.length : 0

    if (score >= threshold) {
      results.push({
        viewpoint: vp,
        score: Math.min(score, 0.9),
        rationale: `标题关键词匹配：${matched.join("、")}`
      })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5)
}

// ─── NoteBlock 生成 ───

async function generateBlocks(
  model: ModelConfig,
  entry: ScoutEntry,
  viewpoint: Viewpoint
): Promise<NoteBlock[]> {
  const content = (entry.content ?? "").slice(0, 2000)

  const prompt = [
    "你是知识库笔记编辑助手。请根据以下信息源内容，生成适合插入知识主题的笔记块。",
    "",
    "规则：",
    "1. 提取核心观点，用简洁的中文重新组织",
    "2. 生成 2-4 个块：一个 heading（标题）+ 若干 paragraph/quote/insight",
    "3. 每个块必须包含 id、type、sortOrder、text 字段",
    "4. id 使用 8 位随机字符串",
    '5. 只输出 JSON：{"blocks":[...]}',
    "",
    `目标主题：${viewpoint.title}`,
    `来源标题：${entry.title}`,
    `来源内容：${content}`,
    entry.author ? `作者：${entry.author}` : null
  ].filter(Boolean).join("\n")

  const apiUrl = `${model.baseUrl.replace(/\/$/, "")}/chat/completions`
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${decryptValue(model.apiKey)}`
    },
    body: JSON.stringify({
      model: model.modelName,
      messages: [{ role: "user", content: prompt }],
      stream: false
    })
  })

  if (!response.ok) {
    return generateFallbackBlocks(entry)
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const answer = data.choices?.[0]?.message?.content?.trim() ?? ""

  try {
    const fenced = answer.match(/```json\s*([\s\S]*?)```/i)
    const jsonText = fenced?.[1]?.trim() ?? answer.trim()
    const objectMatch = jsonText.match(/\{[\s\S]*\}/)
    if (!objectMatch) return generateFallbackBlocks(entry)

    const parsed = JSON.parse(objectMatch[0]) as { blocks?: NoteBlock[] }
    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      return generateFallbackBlocks(entry)
    }

    return parsed.blocks.map((block, i) => ({
      ...block,
      id: block.id || randomUUID().slice(0, 8),
      sortOrder: block.sortOrder ?? i
    }))
  } catch {
    return generateFallbackBlocks(entry)
  }
}

/** 无 AI 时的降级块生成：标题 + 摘要段落 */
function generateFallbackBlocks(entry: ScoutEntry): NoteBlock[] {
  const excerpt = (entry.content ?? "").slice(0, 400)
  return [
    {
      id: randomUUID().slice(0, 8),
      type: "heading",
      level: 3,
      sortOrder: 0,
      text: entry.title ?? "未命名"
    } as NoteBlock,
    {
      id: randomUUID().slice(0, 8),
      type: "paragraph",
      sortOrder: 1,
      text: excerpt
    } as NoteBlock
  ]
}

/**
 * 追问展开：基于用户提问和 patch 上下文生成补充内容
 */
export async function expandPatch(
  userId: string,
  patchId: string,
  userMessage: string
): Promise<string> {
  const patch = repository.getPatch(userId, patchId)
  if (!patch) throw new Error("Patch not found")

  const model = resolveModel(userId)
  if (!model) {
    return "未配置 AI 模型，无法进行追问展开。请在设置中绑定 scout_analyze 功能的模型。"
  }

  const entry = repository.getEntry(userId, patch.entryId)
  const entryContent = entry ? (entry.content ?? "").slice(0, 1500) : patch.sourceSnapshot.excerpt

  const messages = [
    {
      role: "system" as const,
      content: [
        "你是知识库内容分析助手。用户正在审阅一条从信息源匹配到知识主题的建议（Patch）。",
        "请基于原始内容和用户的追问，给出深入分析或补充信息。",
        "",
        `目标主题：${patch.targetViewpointTitle}`,
        `来源：${patch.sourceSnapshot.title ?? patch.sourceSnapshot.url}`,
        `原始内容摘要：${entryContent}`
      ].join("\n")
    },
    // 历史对话
    ...(patch.thread ?? []).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    })),
    { role: "user" as const, content: userMessage }
  ]

  const apiUrl = `${model.baseUrl.replace(/\/$/, "")}/chat/completions`
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${decryptValue(model.apiKey)}`
    },
    body: JSON.stringify({
      model: model.modelName,
      messages,
      stream: false
    })
  })

  if (!response.ok) {
    throw new Error(`AI 模型调用失败: ${response.status}`)
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "无法生成回复"
}
