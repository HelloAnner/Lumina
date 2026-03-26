/**
 * 阅读进度快照工具
 * 负责生成稳定 progress id，并统一书籍与文章的页面定位字段
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import type { Book, ScoutArticle } from "@/src/server/store/types"

export type ReadingResourceType = "book" | "article"

export interface ReadingProgressBase {
  id: string
  progress: number
  currentPageId?: string
  currentPageIndex: number
  updatedAt?: string
}

export interface BookProgressRecord extends ReadingProgressBase {
  currentSectionIndex: number
  currentParagraphIndex: number
  targetLanguage?: string
}

export interface ArticleProgressRecord extends ReadingProgressBase {}

/**
 * 生成稳定的阅读进度 ID
 *
 * @param resourceType
 * @param resourceId
 */
export function buildReadingProgressId(
  resourceType: ReadingResourceType,
  resourceId: string
) {
  return `${resourceType}-progress-${resourceId}`
}

/**
 * 生成书籍阅读进度快照
 *
 * @param book
 * @param sectionIndex
 * @param paragraphIndex
 * @param progress
 * @param targetLanguage
 */
export function buildBookProgressSnapshot(
  book: Book,
  sectionIndex: number,
  paragraphIndex: number,
  progress: number,
  targetLanguage?: string
): BookProgressRecord {
  const safeSectionIndex = clampIndex(sectionIndex, book.content.length)
  const currentSection = book.content[safeSectionIndex]

  return {
    id: buildReadingProgressId("book", book.id),
    progress: clampProgress(progress),
    currentPageId: currentSection?.id,
    currentPageIndex: currentSection?.pageIndex ?? safeSectionIndex + 1,
    currentSectionIndex: safeSectionIndex,
    currentParagraphIndex: Math.max(0, paragraphIndex),
    targetLanguage
  }
}

/**
 * 优先按页面 ID 恢复书籍位置
 *
 * @param book
 * @param progress
 */
export function resolveBookProgressSectionIndex(
  book: Book,
  progress: Pick<BookProgressRecord, "currentPageId" | "currentPageIndex" | "currentSectionIndex">
) {
  if (progress.currentPageId) {
    const pageIdIndex = book.content.findIndex((item) => item.id === progress.currentPageId)
    if (pageIdIndex >= 0) {
      return pageIdIndex
    }
  }
  if (progress.currentPageIndex > 0) {
    const pageIndex = book.content.findIndex((item) => item.pageIndex === progress.currentPageIndex)
    if (pageIndex >= 0) {
      return pageIndex
    }
  }
  return clampIndex(progress.currentSectionIndex, book.content.length)
}

/**
 * 生成文章阅读进度快照
 *
 * @param article
 * @param sectionIndex
 * @param progress
 */
export function buildArticleProgressSnapshot(
  article: ScoutArticle,
  sectionIndex: number,
  progress: number
): ArticleProgressRecord {
  const safeSectionIndex = clampIndex(sectionIndex, article.content.length)
  const currentSection = article.content[safeSectionIndex]

  return {
    id: buildReadingProgressId("article", article.id),
    progress: clampProgress(progress),
    currentPageId: currentSection?.id,
    currentPageIndex: currentSection ? safeSectionIndex + 1 : 0
  }
}

/**
 * 优先按页面 ID 恢复文章位置
 *
 * @param article
 * @param progress
 */
export function resolveArticleProgressSectionIndex(
  article: ScoutArticle,
  progress: Pick<ArticleProgressRecord, "currentPageId" | "currentPageIndex">
) {
  if (progress.currentPageId) {
    const pageIdIndex = article.content.findIndex((item) => item.id === progress.currentPageId)
    if (pageIdIndex >= 0) {
      return pageIdIndex
    }
  }
  if (progress.currentPageIndex > 0) {
    return clampIndex(progress.currentPageIndex - 1, article.content.length)
  }
  return 0
}

function clampIndex(index: number, size: number) {
  return Math.min(Math.max(0, index), Math.max(0, size - 1))
}

function clampProgress(progress: number) {
  return Math.min(1, Math.max(0, progress))
}
