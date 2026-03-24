/**
 * 划线同步服务
 * 将新划线通过向量相似度匹配到已有主题，支持降级到关键词匹配
 * 新建主题时通过大模型汇总生成名称
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/24
 */
import { repository } from "@/src/server/repositories"
import type { Highlight, NoteBlock } from "@/src/server/store/types"
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

/** 相似度阈值：超过此值认为划线与主题相关 */
const SIMILARITY_THRESHOLD = 0.65

/** 降级用关键词词典 */
const TOPIC_DICTIONARY = [
  "第一性原理", "长期主义", "系统思维", "复利", "决策",
  "学习", "写作", "商业", "管理", "认知",
  "思考", "创新", "领导力", "效率", "沟通",
  "心理学", "哲学", "经济", "技术", "设计"
]

/**
 * 降级：关键词提取主题
 */
function extractTopicsByKeyword(highlight: Highlight): string[] {
  const content = `${highlight.content} ${highlight.note ?? ""}`
  const matches = TOPIC_DICTIONARY.filter((kw) => content.includes(kw))
  return matches.length > 0 ? matches : [highlight.content.slice(0, 8)]
}

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
 * 降级匹配：关键词
 */
function matchByKeyword(
  highlight: Highlight,
  viewpoints: ReturnType<typeof repository.listViewpoints>
): { viewpointId: string; similarity: number }[] {
  const topics = extractTopicsByKeyword(highlight)
  const results: { viewpointId: string; similarity: number }[] = []

  for (const topic of topics) {
    const match = viewpoints.find(
      (vp) => !vp.isFolder && (vp.title === topic || vp.title.includes(topic) || topic.includes(vp.title))
    )
    if (match) {
      results.push({ viewpointId: match.id, similarity: 0.88 })
    }
  }

  return results
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

  // 降级：关键词提取
  if (!title) {
    const topics = extractTopicsByKeyword(highlight)
    title = topics[0]
  }

  // 避免和已有主题重名
  const existing = repository.listViewpoints(userId)
  const duplicate = existing.find((vp) => vp.title === title)
  if (duplicate) {
    // 重名说明大模型生成的名字和已有主题一致，直接关联
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
 * 匹配维度：书名 + 章节名 + 划线内容
 * 优先向量匹配，无 embedding 模型时降级关键词
 * 新建主题时通过大模型汇总名称
 * 静默执行，不弹通知
 */
export async function syncPendingHighlights(userId: string): Promise<void> {
  const books = repository.listBooks(userId)
  const pendingHighlights = books.flatMap((book) =>
    repository.listHighlightsByBook(userId, book.id).filter((h) => h.status === "PENDING")
  )

  if (pendingHighlights.length === 0) {
    return
  }

  const hasEmbeddingModel = !!repository.getModelByFeature(userId, "embedding_index")

  if (hasEmbeddingModel) {
    await ensureViewpointVectors(userId)
  }

  const existingViewpoints = repository.listViewpoints(userId)

  for (const highlight of pendingHighlights) {
    let matches: { viewpointId: string; similarity: number }[] = []

    if (hasEmbeddingModel) {
      const vectorMatches = await matchByVector(userId, highlight)
      if (vectorMatches && vectorMatches.length > 0) {
        matches = vectorMatches
      }
    }

    if (matches.length === 0) {
      matches = matchByKeyword(highlight, existingViewpoints)
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
      const newId = await createViewpointForHighlight(userId, highlight)
      if (hasEmbeddingModel) {
        await refreshViewpointVector(userId, newId)
      }
    }

    repository.updateHighlight(userId, highlight.id, { status: "PROCESSED" })
  }
}
