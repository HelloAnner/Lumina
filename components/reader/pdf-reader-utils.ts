/**
 * PDF 阅读器工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
import { buildSidebarTree } from "@/components/reader/reader-sidebar-utils"
import type { SidebarNode } from "@/components/reader/reader-types"
import type { Highlight, TocItem } from "@/src/server/store/types"

export function buildPdfSidebarNodes(toc: TocItem[], pageCount: number): SidebarNode[] {
  const entries = toc
    .filter((item) => typeof item.pageIndex === "number")
    .map((item) => ({
      id: item.id,
      title: item.title,
      sourceIndex: Math.max(0, (item.pageIndex ?? 1) - 1),
      level: item.level ?? 0
    }))

  if (entries.length > 0) {
    return buildSidebarTree(entries)
  }

  return buildSidebarTree(
    Array.from({ length: pageCount }, (_, index) => ({
      id: `page-${index + 1}`,
      title: `第 ${index + 1} 页`,
      sourceIndex: index,
      level: 0
    }))
  )
}

export function findCurrentPdfPageIndex(
  containerTop: number,
  pageRefs: Record<number, HTMLDivElement | null>,
  currentIndex: number
) {
  const keys = Object.keys(pageRefs).map(Number).sort((a, b) => a - b)
  if (keys.length === 0) {
    return currentIndex
  }
  const maxKey = keys[keys.length - 1]
  const start = Math.max(keys[0], currentIndex - 2)
  const end = Math.min(maxKey, currentIndex + 3)
  let nextIndex = currentIndex

  for (let i = start; i <= end; i++) {
    const element = pageRefs[i]
    if (element && element.getBoundingClientRect().top - containerTop <= 120) {
      nextIndex = i
    }
  }
  return nextIndex
}

export function buildClientRectsSnapshot(range: Range) {
  return Array.from(range.getClientRects()).map((item) => ({
    left: item.left,
    top: item.top,
    width: item.width,
    height: item.height
  }))
}

export function pickPdfCurrentHighlightId(
  items: Highlight[],
  currentPageIndex: number
) {
  const matches = items.filter((item) => (item.pageIndex ?? 1) - 1 === currentPageIndex)
  return matches.at(-1)?.id ?? items[0]?.id ?? ""
}

export function scrollElementIntoReader(
  container: HTMLDivElement,
  target: HTMLElement,
  offset = 24
) {
  const top =
    target.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    offset
  container.scrollTo({
    top: Math.max(0, top),
    behavior: "auto"
  })
}
