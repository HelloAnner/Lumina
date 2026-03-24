/**
 * 阅读器翻译预取工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import type {
  TocItem,
  TocTranslationItem,
  TranslationDisplayMode
} from "@/src/server/store/types"

export interface TranslationPrefetchPlanInput {
  currentIndex: number
  totalSections: number
  cachedIndexes: number[]
  busyIndexes: number[]
  windowSize?: number
}

export function buildDisplayToc(
  toc: TocItem[],
  translated: { items: TocTranslationItem[] } | null,
  translationView: TranslationDisplayMode
) {
  if (translationView !== "translation" || !translated?.items?.length) {
    return toc
  }
  const translatedMap = new Map(translated.items.map((item) => [item.id, item.title]))
  return toc.map((item) => ({
    ...item,
    title: translatedMap.get(item.id) ?? item.title
  }))
}

function buildWindowIndexes(currentIndex: number, totalSections: number, windowSize: number) {
  return Array.from({ length: windowSize }, (_, index) => currentIndex + index)
    .filter((index) => index >= 0 && index < totalSections)
}

function isMissingIndex(index: number, cachedIndexes: Set<number>, busyIndexes: Set<number>) {
  return !cachedIndexes.has(index) && !busyIndexes.has(index)
}

export function buildTranslationPrefetchPlan(input: TranslationPrefetchPlanInput) {
  const windowSize = input.windowSize ?? 4
  const cachedIndexes = new Set(input.cachedIndexes)
  const busyIndexes = new Set(input.busyIndexes)
  const indexes = buildWindowIndexes(input.currentIndex, input.totalSections, windowSize)
  const requestedSectionIndexes = indexes.filter((index) =>
    isMissingIndex(index, cachedIndexes, busyIndexes)
  )

  return {
    urgentSectionIndexes: requestedSectionIndexes.filter((index) => index === input.currentIndex),
    queuedSectionIndexes: requestedSectionIndexes.filter((index) => index !== input.currentIndex),
    requestedSectionIndexes
  }
}
