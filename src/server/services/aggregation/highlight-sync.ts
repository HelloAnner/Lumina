/**
 * 划线同步服务
 * 将新划线优先匹配到已有主题，支持写入多个相关主题
 * 匹配策略：向量 > 大模型分类 > 关键词，仅无匹配时创建新主题
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/24
 */
import { repository } from "@/src/server/repositories"
import type { Highlight, NoteBlock } from "@/src/server/store/types"
import { decryptValue } from "@/src/server/lib/crypto"
import {
  generateEmbedding,
  buildHighlightText,
  buildViewpointText,
  generateTopicTitle
} from "./embedding"
import {
  upsertHighlightVector,
  upsertViewpointVector,
  searchSimilarViewpoints
} from "./vector-store"

/** 向量相似度阈值：降低以鼓励匹配已有主题 */
const SIMILARITY_THRESHOLD = 0.45

/**
 * 为 viewpoint 追加一条划线引用块
 */
function appendHighlightToBlocks(
  existingBlocks: NoteBlock[],
  highlight: Highlight,
  bookTitle?: string
): NoteBlock[] {
  const maxSort = existingBlocks.reduce((max, b) => Math.max(max, b.sortOrder), 0)

  const newBlocks: NoteBlock[] = [
    {
      id: crypto.randomUUID(),
      type: "quote",
      text: highlight.content,
      sourceBookId: highlight.bookId,
      sourceBookTitle: bookTitle,
      highlightId: highlight.id,
      sortOrder: maxSort + 1
    }
  ]

  if (highlight.note) {
    newBlocks.push({
      id: crypto.randomUUID(),
      type: "insight",
      text: highlight.note,
      label: "批注",
      sortOrder: maxSort + 2
    })
  }

  return [...existingBlocks, ...newBlocks]
}

/**
 * 构建新主题的初始块内容
 */
function buildInitialBlocks(title: string, highlight: Highlight, bookTitle?: string): NoteBlock[] {
  const blocks: NoteBlock[] = [
    { id: crypto.randomUUID(), type: "heading", level: 1, text: title, sortOrder: 0 },
    { id: crypto.randomUUID(), type: "divider", sortOrder: 1 },
    {
      id: crypto.randomUUID(),
      type: "quote",
      text: highlight.content,
      sourceBookId: highlight.bookId,
      sourceBookTitle: bookTitle,
      highlightId: highlight.id,
      sortOrder: 2
    }
  ]
  if (highlight.note) {
    blocks.push({
      id: crypto.randomUUID(),
      type: "insight",
      text: highlight.note,
      label: "批注",
      sortOrder: 3
    })
  }
  return blocks
}

/**
 * 向量匹配：结合书名+章节+划线内容三维度
 */
async function matchByVector(
  userId: string,
  highlight: Highlight
): Promise<{ viewpointId: string; similarity: number }[] | null> {
  const text = buildHighlightText(userId, highlight)
  const embedding = await generateEmbedding(userId, text)
  if (!embedding) {
    return null
  }

  await upsertHighlightVector(highlight.id, userId, embedding)
  return searchSimilarViewpoints(userId, embedding, SIMILARITY_THRESHOLD)
}

/**
 * 大模型匹配：让模型从已有主题中选择相关的
 * 鼓励匹配多个、鼓励写入已有主题
 */
async function matchByLLM(
  userId: string,
  highlight: Highlight,
  viewpoints: { id: string; title: string }[]
): Promise<{ viewpointId: string; similarity: number }[]> {
  if (viewpoints.length === 0) {
    return []
  }

  const featureOrder = ["aggregation_analyze", "article_generate", "instant_explain"] as const
  let model = null
  for (const feature of featureOrder) {
    model = repository.getModelByFeature(userId, feature)
    if (model) {
      break
    }
  }
  if (!model) {
    return []
  }

  const book = repository.getBook(userId, highlight.bookId)
  const bookTitle = book?.title ?? "未知书籍"

  const vpList = viewpoints.map((vp, i) => `${i + 1}. ${vp.title}`).join("\n")
  const prompt = [
    "以下是用户的一条阅读划线，以及已有的主题列表。",
    "请判断这条划线与哪些主题相关，可以归入多个主题。",
    "只要主题和划线有一定关联就应该归入，鼓励归入多个主题。",
    "如果确实没有任何相关主题，输出「无」。",
    "",
    "输出格式：只输出相关主题的编号，用逗号分隔。例如：1,3,5",
    "如果无相关主题，只输出：无",
    "",
    `书名：${bookTitle}`,
    `划线内容：${highlight.content}`,
    highlight.note ? `批注：${highlight.note}` : null,
    "",
    "已有主题列表：",
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

  if (!response.ok) {
    console.error(`[highlight-sync] LLM match API error ${response.status}`)
    return []
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const answer = data.choices?.[0]?.message?.content?.trim() ?? ""

  if (answer === "无" || !answer) {
    return []
  }

  // 解析编号列表
  const indices = answer.match(/\d+/g)?.map(Number) ?? []
  return indices
    .filter((i) => i >= 1 && i <= viewpoints.length)
    .map((i) => ({
      viewpointId: viewpoints[i - 1].id,
      similarity: 0.8
    }))
}

/**
 * 降级匹配：基于文本重叠的宽松匹配
 * 将划线内容与已有主题标题和内容做双向子串匹配
 */
function matchByText(
  highlight: Highlight,
  viewpoints: ReturnType<typeof repository.listViewpoints>
): { viewpointId: string; similarity: number }[] {
  const content = `${highlight.content} ${highlight.note ?? ""}`
  const results: { viewpointId: string; similarity: number }[] = []

  for (const vp of viewpoints) {
    if (vp.isFolder) {
      continue
    }
    // 标题出现在划线内容中，或划线关键词出现在主题标题/内容中
    const titleInContent = content.includes(vp.title)
    const contentInTitle = vp.title.length >= 2 && highlight.content.includes(vp.title)

    // 从划线中提取 2-4 字的词组与主题标题比较
    const keywords = extractKeyPhrases(content)
    const keywordInTitle = keywords.some((kw) => vp.title.includes(kw))
    const titleKeywords = extractKeyPhrases(vp.title)
    const titleKwInContent = titleKeywords.some((kw) => content.includes(kw))

    // 同一本书的主题更容易匹配
    const sameBook = vp.relatedBookIds.includes(highlight.bookId)

    if (titleInContent || contentInTitle) {
      results.push({ viewpointId: vp.id, similarity: 0.85 })
    } else if ((keywordInTitle || titleKwInContent) && sameBook) {
      results.push({ viewpointId: vp.id, similarity: 0.7 })
    } else if (keywordInTitle || titleKwInContent) {
      results.push({ viewpointId: vp.id, similarity: 0.6 })
    } else if (sameBook) {
      // 同一本书的主题，默认有弱关联
      results.push({ viewpointId: vp.id, similarity: 0.5 })
    }
  }

  return results
}

/**
 * 从文本中提取关键短语（2-4字）
 */
function extractKeyPhrases(text: string): string[] {
  // 移除标点，按常见分隔切词
  const cleaned = text.replace(/[，。、；：！？""''（）《》\s]+/g, "|")
  const segments = cleaned.split("|").filter((s) => s.length >= 2 && s.length <= 8)
  return segments
}

/**
 * 刷新主题的向量
 */
async function refreshViewpointVector(userId: string, viewpointId: string) {
  const viewpoint = repository.getViewpoint(userId, viewpointId)
  if (!viewpoint || viewpoint.isFolder) {
    return
  }

  const text = buildViewpointText(viewpoint.title, viewpoint.articleContent)
  const embedding = await generateEmbedding(userId, text)
  if (embedding) {
    await upsertViewpointVector(viewpointId, userId, embedding)
  }
}

/**
 * 初始化已有主题的向量（首次使用时）
 */
async function ensureViewpointVectors(userId: string) {
  const viewpoints = repository.listViewpoints(userId).filter((vp) => !vp.isFolder)
  for (const vp of viewpoints) {
    const text = buildViewpointText(vp.title, vp.articleContent)
    const embedding = await generateEmbedding(userId, text)
    if (embedding) {
      await upsertViewpointVector(vp.id, userId, embedding)
    }
  }
}

/**
 * 关联划线到主题，并追加内容
 */
function linkHighlightToViewpoint(
  userId: string,
  highlight: Highlight,
  viewpointId: string,
  similarity: number
) {
  const viewpoint = repository.getViewpoint(userId, viewpointId)
  if (!viewpoint) {
    return
  }

  // 避免重复追加
  const existingQuotes = (viewpoint.articleBlocks ?? []).filter(
    (b) => b.type === "quote" && "highlightId" in b && b.highlightId === highlight.id
  )
  if (existingQuotes.length > 0) {
    return
  }

  repository.upsertHighlightLink({
    highlightId: highlight.id,
    viewpointId,
    similarityScore: similarity,
    confirmed: true
  })

  const book = repository.getBook(userId, highlight.bookId)
  const updatedBlocks = appendHighlightToBlocks(
    viewpoint.articleBlocks ?? [],
    highlight,
    book?.title
  )

  const note = highlight.note ? `\n我的批注：${highlight.note}` : ""
  const newSection = `\n\n> ${highlight.content}${note}`

  repository.updateViewpoint(userId, viewpointId, {
    highlightCount: viewpoint.highlightCount + 1,
    isCandidate: false,
    relatedBookIds: Array.from(new Set([...viewpoint.relatedBookIds, highlight.bookId])),
    articleContent: viewpoint.articleContent + newSection,
    articleBlocks: updatedBlocks,
    lastSynthesizedAt: new Date().toISOString()
  })
}

/**
 * 为无匹配的划线创建新主题
 * 优先用大模型生成主题名，降级到关键词提取
 */
async function createViewpointForHighlight(userId: string, highlight: Highlight): Promise<string> {
  // 用大模型汇总主题名称
  let title = await generateTopicTitle(userId, highlight)

  // 降级：取划线前8字作为名称
  if (!title) {
    title = highlight.content.replace(/[，。、；：！？""''（）《》\s]+/g, "").slice(0, 8)
  }

  // 避免和已有主题重名
  const existing = repository.listViewpoints(userId)
  const duplicate = existing.find((vp) => vp.title === title)
  if (duplicate) {
    linkHighlightToViewpoint(userId, highlight, duplicate.id, 0.9)
    return duplicate.id
  }

  const book = repository.getBook(userId, highlight.bookId)

  const viewpoint = repository.createViewpoint({
    userId,
    title,
    parentId: undefined,
    isFolder: false,
    isCandidate: true,
    sortOrder: existing.length + 1,
    articleContent: `# ${title}\n\n> ${highlight.content}`,
    relatedBookIds: [highlight.bookId]
  })

  repository.updateViewpoint(userId, viewpoint.id, {
    articleBlocks: buildInitialBlocks(title, highlight, book?.title),
    highlightCount: 1
  })

  repository.upsertHighlightLink({
    highlightId: highlight.id,
    viewpointId: viewpoint.id,
    similarityScore: 1.0,
    confirmed: true
  })

  return viewpoint.id
}

/**
 * 增量同步划线到主题树
 * 策略：优先匹配已有主题（向量 > 大模型 > 文本），鼓励写入多个
 * 仅当所有匹配手段都无结果时才创建新主题
 */
export async function syncPendingHighlights(userId: string): Promise<void> {
  const pendingHighlights = repository.listHighlightsByStatus(userId, "PENDING")

  if (pendingHighlights.length === 0) {
    return
  }

  console.log(`[highlight-sync] syncing ${pendingHighlights.length} pending highlights`)

  const hasEmbeddingModel = !!repository.getModelByFeature(userId, "embedding_index")

  if (hasEmbeddingModel) {
    await ensureViewpointVectors(userId)
  }

  for (const highlight of pendingHighlights) {
    // 每次迭代重新获取最新的主题列表（前面的划线可能创建了新主题）
    const existingViewpoints = repository.listViewpoints(userId)
    const nonFolderViewpoints = existingViewpoints.filter((vp) => !vp.isFolder)

    let matches: { viewpointId: string; similarity: number }[] = []

    // 第一优先：向量匹配
    if (hasEmbeddingModel) {
      const vectorMatches = await matchByVector(userId, highlight)
      if (vectorMatches && vectorMatches.length > 0) {
        matches = vectorMatches
      }
    }

    // 第二优先：大模型分类（无 embedding 或向量无匹配时）
    if (matches.length === 0 && nonFolderViewpoints.length > 0) {
      matches = await matchByLLM(userId, highlight, nonFolderViewpoints)
    }

    // 第三优先：文本匹配
    if (matches.length === 0) {
      matches = matchByText(highlight, existingViewpoints)
    }

    if (matches.length > 0) {
      for (const match of matches) {
        linkHighlightToViewpoint(userId, highlight, match.viewpointId, match.similarity)
      }
      if (hasEmbeddingModel) {
        for (const match of matches) {
          await refreshViewpointVector(userId, match.viewpointId)
        }
      }
    } else {
      // 所有匹配手段都失败，才创建新主题
      const newId = await createViewpointForHighlight(userId, highlight)
      if (hasEmbeddingModel) {
        await refreshViewpointVector(userId, newId)
      }
    }

    repository.updateHighlight(userId, highlight.id, { status: "PROCESSED" })
  }
}
