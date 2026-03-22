import { repository } from "@/src/server/repositories"
import type { Highlight, ViewpointRelation } from "@/src/server/store/types"

const TOPIC_DICTIONARY = [
  "第一性原理",
  "长期主义",
  "系统思维",
  "复利",
  "决策",
  "学习",
  "写作",
  "商业",
  "管理"
]

function extractTopics(highlight: Highlight) {
  const content = `${highlight.content} ${highlight.note ?? ""}`
  const matches = TOPIC_DICTIONARY.filter((item) => content.includes(item))
  if (matches.length > 0) {
    return matches
  }
  return [highlight.content.slice(0, 8)]
}

function buildArticle(title: string, materials: Highlight[]) {
  const sections = materials
    .map((item) => {
      const note = item.note ? `\n我的批注：${item.note}` : ""
      return `> 引用\n> ${item.content}${note}`
    })
    .join("\n\n")

  return `# ${title}\n\n## 核心论点\n我把这个主题理解为一个不断被验证的认知框架。\n\n## 论据与展开\n${sections}\n\n## 我的理解\n这些材料说明，真正有效的学习不是堆积信息，而是持续把信息转成稳定行动。`
}

export function runAggregation(userId: string) {
  const highlights = repository
    .listBooks(userId)
    .flatMap((book) => repository.listHighlightsByBook(userId, book.id))

  repository.updateAggregateJob(userId, {
    status: "RUNNING",
    stage: "vectorizing",
    total: highlights.length,
    processed: 0
  })

  const grouped = new Map<string, Highlight[]>()

  highlights.forEach((highlight, index) => {
    const topics = extractTopics(highlight)
    topics.forEach((topic) => {
      const bucket = grouped.get(topic) ?? []
      bucket.push(highlight)
      grouped.set(topic, bucket)
    })
    repository.updateAggregateJob(userId, {
      stage: "matching",
      processed: index + 1,
      total: highlights.length
    })
  })

  const existing = repository.listViewpoints(userId)
  const relations: ViewpointRelation[] = []

  grouped.forEach((materials, topic) => {
    let viewpoint = existing.find((item) => item.title === topic)
    if (!viewpoint) {
      viewpoint = repository.createViewpoint({
        userId,
        title: topic,
        parentId: undefined,
        isFolder: false,
        isCandidate: materials.length < 2,
        sortOrder: existing.length + relations.length + 1,
        articleContent: "",
        relatedBookIds: []
      })
    }

    const relatedBookIds = Array.from(new Set(materials.map((item) => item.bookId)))
    repository.updateViewpoint(userId, viewpoint.id, {
      highlightCount: materials.length,
      isCandidate: materials.length < 2,
      relatedBookIds,
      articleContent: buildArticle(topic, materials),
      lastSynthesizedAt: new Date().toISOString()
    })

    materials.forEach((highlight) => {
      repository.upsertHighlightLink({
        highlightId: highlight.id,
        viewpointId: viewpoint!.id,
        similarityScore: 0.88,
        confirmed: true
      })
      repository.updateHighlight(userId, highlight.id, { status: "PROCESSED" })
    })
  })

  const viewpoints = repository.listViewpoints(userId).filter((item) => !item.isFolder)
  viewpoints.forEach((source) => {
    viewpoints.forEach((target) => {
      if (source.id === target.id) {
        return
      }
      const shared = Math.min(source.highlightCount, target.highlightCount)
      if (shared === 0) {
        return
      }
      relations.push({
        sourceId: source.id,
        targetId: target.id,
        weight: Number((shared / (source.highlightCount + target.highlightCount)).toFixed(2))
      })
    })
  })

  repository.replaceRelations(userId, relations)
  repository.updateAggregateJob(userId, {
    status: "DONE",
    stage: "done",
    processed: highlights.length,
    total: highlights.length
  })

  return repository.getAggregateJob(userId)
}
