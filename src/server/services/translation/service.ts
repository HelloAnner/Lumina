/**
 * 阅读翻译服务
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import { repository } from "@/src/server/repositories"
import type {
  ArticleSection,
  Book,
  BookTocTranslation,
  BookTranslation,
  ModelConfig
} from "@/src/server/store/types"
import {
  buildTocSourceHash,
  buildTranslatedTocItems,
  buildSectionSourceHash,
  buildTranslatedSectionSnapshot,
  collectSectionParagraphs,
  collectTocTitles
} from "@/src/server/services/translation/section-content"
import {
  extractModelMessageContent,
  requestTranslatedParagraphs
} from "@/src/server/services/translation/request"
import {
  buildArticleSourceHash,
  buildNormalizedTranslatedArticleSections,
  collectArticleParagraphs,
  buildTranslatedArticleSections
} from "@/src/server/services/translation/article-content"

interface TranslateSectionInput {
  userId: string
  book: Book
  sectionIndex: number
  targetLanguage: string
  model: ModelConfig
}

const DEFAULT_TARGET_LANGUAGE = "zh-CN"
const inflightTranslations = new Map<string, Promise<BookTranslation>>()
const inflightTocTranslations = new Map<string, Promise<BookTocTranslation>>()

function normalizeSectionIndexes(sectionIndexes: number[], totalSections: number) {
  return Array.from(new Set(sectionIndexes))
    .filter((index) => index >= 0 && index < totalSections)
    .sort((left, right) => left - right)
}

function buildCacheKey(sectionId: string, sourceHash: string, targetLanguage: string) {
  return `${sectionId}:${sourceHash}:${targetLanguage}`
}

function buildCachedTranslationMap(items: BookTranslation[]) {
  return new Map(
    items.map((item) => [
      buildCacheKey(item.sectionId, item.sourceHash, item.targetLanguage),
      item
    ])
  )
}

function buildCachedTocTranslationMap(items: BookTocTranslation[]) {
  return new Map(
    items.map((item) => [buildCacheKey("__toc__", item.sourceHash, item.targetLanguage), item])
  )
}

async function translateSection(input: TranslateSectionInput) {
  const section = input.book.content[input.sectionIndex]
  const sourceHash = buildSectionSourceHash(section)
  const cacheKey = buildCacheKey(section.id, sourceHash, input.targetLanguage)
  const activeTask = inflightTranslations.get(cacheKey)
  if (activeTask) {
    return activeTask
  }
  const task = translateAndCacheSection(input, section, sourceHash)
  inflightTranslations.set(cacheKey, task)
  try {
    return await task
  } finally {
    inflightTranslations.delete(cacheKey)
  }
}

async function translateAndCacheSection(
  input: TranslateSectionInput,
  section: Book["content"][number],
  sourceHash: string
) {
  const paragraphs = collectSectionParagraphs(section)
  const translatedParagraphs = await requestTranslatedParagraphs(
    paragraphs,
    input.model,
    input.targetLanguage
  )
  const snapshot = buildTranslatedSectionSnapshot(section, translatedParagraphs)
  return repository.upsertBookTranslation({
    userId: input.userId,
    bookId: input.book.id,
    sectionId: section.id,
    sectionIndex: input.sectionIndex,
    pageIndex: section.pageIndex,
    chapterHref: section.href,
    sourceHash,
    targetLanguage: input.targetLanguage,
    content: snapshot.content,
    blocks: snapshot.blocks,
    modelId: input.model.id
  })
}

async function translateBookToc(input: {
  userId: string
  book: Book
  targetLanguage: string
  model: ModelConfig
}) {
  const sourceHash = buildTocSourceHash(input.book.toc)
  const cacheKey = buildCacheKey("__toc__", sourceHash, input.targetLanguage)
  const activeTask = inflightTocTranslations.get(cacheKey)
  if (activeTask) {
    return activeTask
  }
  const task = translateAndCacheBookToc(input, sourceHash)
  inflightTocTranslations.set(cacheKey, task)
  try {
    return await task
  } finally {
    inflightTocTranslations.delete(cacheKey)
  }
}

async function translateAndCacheBookToc(
  input: {
    userId: string
    book: Book
    targetLanguage: string
    model: ModelConfig
  },
  sourceHash: string
) {
  const translatedTitles = await requestTranslatedParagraphs(
    collectTocTitles(input.book.toc),
    input.model,
    input.targetLanguage
  )
  return repository.upsertBookTocTranslation({
    userId: input.userId,
    bookId: input.book.id,
    sourceHash,
    targetLanguage: input.targetLanguage,
    items: buildTranslatedTocItems(input.book.toc, translatedTitles),
    modelId: input.model.id
  })
}

function collectMissingSections(
  book: Book,
  sectionIndexes: number[],
  targetLanguage: string,
  cachedMap: Map<string, BookTranslation>
) {
  const cachedItems: BookTranslation[] = []
  const missingIndexes: number[] = []

  sectionIndexes.forEach((sectionIndex) => {
    const section = book.content[sectionIndex]
    const cacheKey = buildCacheKey(
      section.id,
      buildSectionSourceHash(section),
      targetLanguage
    )
    const cached = cachedMap.get(cacheKey)
    if (cached) {
      cachedItems.push(cached)
      return
    }
    missingIndexes.push(sectionIndex)
  })

  return {
    cachedItems,
    missingIndexes
  }
}

function sortByRequestedOrder(sectionIndexes: number[], items: BookTranslation[]) {
  const orderMap = new Map(sectionIndexes.map((index, order) => [index, order]))
  return [...items].sort((left, right) => {
    return (orderMap.get(left.sectionIndex) ?? 0) - (orderMap.get(right.sectionIndex) ?? 0)
  })
}

function validateTranslationModel(model: ModelConfig | null) {
  if (!model?.baseUrl || !model.apiKey || !model.modelName || model.modelName === "未配置") {
    throw new Error("请先在设置中为阅读翻译分配语言模型")
  }
}

export async function prefetchBookTranslations(input: {
  userId: string
  book: Book
  sectionIndexes: number[]
  targetLanguage?: string
  model: ModelConfig | null
}) {
  const targetLanguage = input.targetLanguage ?? DEFAULT_TARGET_LANGUAGE
  const sectionIndexes = normalizeSectionIndexes(
    input.sectionIndexes,
    input.book.content.length
  )
  const cachedMap = buildCachedTranslationMap(
    repository.listBookTranslations(input.userId, input.book.id)
  )
  const tocSourceHash = buildTocSourceHash(input.book.toc)
  const cachedTocMap = buildCachedTocTranslationMap(
    repository.listBookTocTranslations(input.userId, input.book.id)
  )
  const cachedToc = cachedTocMap.get(
    buildCacheKey("__toc__", tocSourceHash, targetLanguage)
  )
  const { cachedItems, missingIndexes } = collectMissingSections(
    input.book,
    sectionIndexes,
    targetLanguage,
    cachedMap
  )
  const needsTocTranslation = input.book.toc.length > 0 && !cachedToc
  if (missingIndexes.length > 0 || needsTocTranslation) {
    validateTranslationModel(input.model)
  }
  const translatedItems = missingIndexes.length === 0
    ? []
    : await Promise.all(
        missingIndexes.map((sectionIndex) =>
          translateSection({
            userId: input.userId,
            book: input.book,
            sectionIndex,
            targetLanguage,
            model: input.model!
          })
        )
      )
  const toc = cachedToc
    ? cachedToc
    : needsTocTranslation
      ? await translateBookToc({
          userId: input.userId,
          book: input.book,
          targetLanguage,
          model: input.model!
        })
      : null

  return {
    items: sortByRequestedOrder(sectionIndexes, [...cachedItems, ...translatedItems]),
    toc
  }
}

/** 文章翻译 */
export async function prefetchArticleTranslations(input: {
  userId: string
  articleId: string
  title: string
  sections: ArticleSection[]
  targetLanguage?: string
  model: ModelConfig | null
}) {
  const targetLanguage = input.targetLanguage ?? DEFAULT_TARGET_LANGUAGE
  const sourceHash = buildArticleSourceHash(input.sections)

  // 检查缓存
  const cached = repository.listArticleTranslations(input.userId, input.articleId)
    .find((t) => t.sourceHash === sourceHash && t.targetLanguage === targetLanguage)
  if (cached) {
    const article = repository.getArticle(input.userId, input.articleId)
    return {
      content: buildNormalizedTranslatedArticleSections(input.sections, cached.content),
      translatedTitle: article?.translatedTitle ?? input.title
    }
  }

  validateTranslationModel(input.model)

  // 标题与正文一起翻译，保持上下文连贯
  const paragraphs = collectArticleParagraphs(input.sections)
  const allParagraphs = [input.title, ...paragraphs]
  const allTranslated = await requestTranslatedParagraphs(allParagraphs, input.model!, targetLanguage)
  const translatedTitle = allTranslated[0] ?? input.title
  const translatedParagraphs = allTranslated.slice(1)
  const translatedSections = buildTranslatedArticleSections(input.sections, translatedParagraphs)

  repository.upsertArticleTranslation({
    userId: input.userId,
    articleId: input.articleId,
    sourceHash,
    targetLanguage,
    content: translatedSections,
    modelId: input.model!.id
  })

  // 持久化翻译标题
  repository.updateArticle(input.userId, input.articleId, { translatedTitle })

  return { content: translatedSections, translatedTitle }
}

export { buildTranslatedSectionSnapshot, extractModelMessageContent }
