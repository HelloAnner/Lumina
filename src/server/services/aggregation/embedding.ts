/**
 * Embedding 服务
 * 调用用户配置的 embedding 模型生成文本向量
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/24
 */
import { decryptValue } from "@/src/server/lib/crypto"
import { repository } from "@/src/server/repositories"
import type { Highlight, TocItem } from "@/src/server/store/types"

/**
 * 为文本生成 embedding 向量
 * 使用用户绑定的 embedding_index 模型
 */
export async function generateEmbedding(
  userId: string,
  text: string
): Promise<number[] | null> {
  const model = repository.getModelByFeature(userId, "embedding_index")
  if (!model) {
    return null
  }

  const apiUrl = `${model.baseUrl.replace(/\/$/, "")}/embeddings`
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${decryptValue(model.apiKey)}`
    },
    body: JSON.stringify({
      model: model.modelName,
      input: text
    })
  })

  if (!response.ok) {
    console.error(`embedding API error ${response.status}`)
    return null
  }

  const data = (await response.json()) as {
    data?: { embedding?: number[] }[]
  }

  return data.data?.[0]?.embedding ?? null
}

/**
 * 从 TOC 中解析划线所在的章节名
 */
function resolveChapterName(highlight: Highlight, toc: TocItem[]): string | undefined {
  if (!toc || toc.length === 0) {
    return undefined
  }

  // EPUB: 按 chapterHref 匹配
  if (highlight.format === "EPUB" && highlight.chapterHref) {
    const chapter = toc.find((item) => item.href === highlight.chapterHref)
    return chapter?.title
  }

  // PDF: 按 pageIndex 查找最近的前置章节
  if (highlight.format === "PDF" && highlight.pageIndex != null) {
    const sorted = toc
      .filter((item) => item.pageIndex != null)
      .sort((a, b) => a.pageIndex! - b.pageIndex!)
    const chapter = sorted.filter((item) => item.pageIndex! <= highlight.pageIndex!).pop()
    return chapter?.title
  }

  return undefined
}

/**
 * 构建划线的完整上下文文本（用于生成向量）
 * 三维度：书名 + 章节名 + 划线内容/批注
 */
export function buildHighlightText(userId: string, highlight: Highlight): string {
  const book = repository.getBook(userId, highlight.bookId)
  const bookTitle = book?.title ?? ""
  const chapterName = book ? resolveChapterName(highlight, book.toc) : undefined

  const parts: string[] = []
  if (bookTitle) {
    parts.push(`书名：${bookTitle}`)
  }
  if (chapterName) {
    parts.push(`章节：${chapterName}`)
  }
  parts.push(`内容：${highlight.content}`)
  if (highlight.note) {
    parts.push(`批注：${highlight.note}`)
  }

  return parts.join("\n")
}

/**
 * 构建主题的文本表示（用于生成向量）
 * 标题 + 文档内容摘要
 */
export function buildViewpointText(
  title: string,
  articleContent: string
): string {
  const content = articleContent.slice(0, 2000)
  return `${title}\n${content}`
}

/**
 * 调用大模型为划线生成主题名称
 * 结合书名、章节名、划线内容三个维度汇总
 */
export async function generateTopicTitle(
  userId: string,
  highlight: Highlight
): Promise<string | null> {
  // 优先用 aggregation_analyze，退而求其次用 article_generate 或 instant_explain
  const featureOrder = ["aggregation_analyze", "article_generate", "instant_explain"] as const
  let model = null
  for (const feature of featureOrder) {
    model = repository.getModelByFeature(userId, feature)
    if (model) {
      break
    }
  }

  if (!model) {
    return null
  }

  const book = repository.getBook(userId, highlight.bookId)
  const bookTitle = book?.title ?? "未知书籍"
  const chapterName = book ? resolveChapterName(highlight, book.toc) : undefined

  const prompt = [
    "请为以下划线笔记生成一个简洁的主题名称（2-8个字），要求能概括其核心知识点。",
    "只输出主题名称本身，不要加引号、序号或其他内容。",
    "",
    `书名：${bookTitle}`,
    chapterName ? `章节：${chapterName}` : null,
    `划线内容：${highlight.content}`,
    highlight.note ? `批注：${highlight.note}` : null
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
    console.error(`topic generation API error ${response.status}`)
    return null
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }

  const title = data.choices?.[0]?.message?.content?.trim()
  // 防御：截断过长的返回、去掉引号
  if (!title) {
    return null
  }
  return title.replace(/^["'《「]|["'》」]$/g, "").slice(0, 20)
}
