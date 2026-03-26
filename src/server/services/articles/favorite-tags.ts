/**
 * 收藏文章自动标签服务
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import { decryptValue } from "@/src/server/lib/crypto"
import { repository } from "@/src/server/repositories"
import type { Highlight, ModelConfig, ScoutArticle } from "@/src/server/store/types"

export function applyFavoriteTopics(
  existingTopics: Array<{ id: string; name: string }>,
  candidateNames: string[]
) {
  const normalizedMap = new Map(
    existingTopics.map((topic) => [topic.name.trim().toLowerCase(), topic])
  )
  const topicIds: string[] = []
  const newTopics: string[] = []

  for (const name of candidateNames) {
    const normalized = name.trim().toLowerCase()
    if (!normalized) {
      continue
    }
    const existing = normalizedMap.get(normalized)
    if (existing) {
      if (!topicIds.includes(existing.id)) {
        topicIds.push(existing.id)
      }
      continue
    }
    const generatedId = `generated:${name.trim()}`
    if (!topicIds.includes(generatedId)) {
      topicIds.push(generatedId)
      newTopics.push(name.trim())
    }
  }

  return { topicIds, newTopics }
}

function pickFavoriteModel(userId: string) {
  return (
    repository.getModelByFeature(userId, "aggregation_analyze") ||
    repository.getModelByFeature(userId, "article_generate") ||
    repository.getModelByFeature(userId, "instant_explain")
  )
}

function buildFallbackTopicNames(article: ScoutArticle, highlights: Highlight[]) {
  const names = article.title
    .split(/[：:|｜\-—]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
  const highlight = highlights[0]?.content?.trim()
  if (highlight) {
    names.push(highlight.slice(0, 10))
  }
  return Array.from(new Set(names)).slice(0, 3)
}

async function requestTopicNames(
  article: ScoutArticle,
  highlights: Highlight[],
  model: ModelConfig
) {
  const prompt = [
    "你是文章标签助手。",
    "请根据文章标题和用户划线内容，为文章生成 1 到 3 个中文主题标签。",
    "要求：标签短、可复用、适合长期分类；不要输出泛词；优先提炼主题，不要复述句子。",
    "只输出 JSON：{\"topics\":[\"标签1\",\"标签2\"]}",
    "",
    `标题：${article.title}`,
    highlights.length > 0
      ? `划线：${highlights.map((item) => `${item.content}${item.note ? `（${item.note}）` : ""}`).join("；")}`
      : "划线：暂无，主要参考标题"
  ].join("\n")

  const response = await fetch(`${model.baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
    throw new Error("favorite tag generation failed")
  }
  const data = await response.json().catch(() => null)
  const content = String(data?.choices?.[0]?.message?.content ?? "").trim()
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0] ?? content
  const parsed = JSON.parse(jsonText) as { topics?: string[] }
  return (parsed.topics ?? [])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 3)
}

export async function autoTagFavoritedArticle(userId: string, articleId: string) {
  const article = repository.getArticle(userId, articleId)
  if (!article?.favorite) {
    return null
  }
  const highlights = repository
    .listHighlightsByBook(userId, articleId)
    .filter((item) => item.sourceType === "article")
  const existingTopics = repository.listArticleTopics(userId)
  const model = pickFavoriteModel(userId)

  let candidateNames: string[] = []
  if (model?.baseUrl && model.apiKey && model.modelName && model.modelName !== "未配置") {
    try {
      candidateNames = await requestTopicNames(article, highlights, model)
    } catch {
      candidateNames = buildFallbackTopicNames(article, highlights)
    }
  } else {
    candidateNames = buildFallbackTopicNames(article, highlights)
  }

  const applied = applyFavoriteTopics(
    existingTopics.map((item) => ({ id: item.id, name: item.name })),
    candidateNames
  )
  const createdTopics = applied.newTopics.map((name, index) =>
    repository.createArticleTopic(userId, {
      name,
      description: "AI 自动生成",
      sortOrder: existingTopics.length + index + 1
    })
  )
  const topicIds = Array.from(
    new Set([
      ...article.topics,
      ...applied.topicIds.filter((id) => !id.startsWith("generated:")),
      ...createdTopics.map((item) => item.id)
    ])
  )

  repository.updateArticle(userId, articleId, { topics: topicIds })
  return repository.getArticle(userId, articleId)
}
