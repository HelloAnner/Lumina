/**
 * 阅读器侧栏滚动工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
export function computeCenteredScrollTop({
  containerHeight,
  contentHeight,
  itemTop,
  itemHeight
}: {
  containerHeight: number
  contentHeight: number
  itemTop: number
  itemHeight: number
}) {
  const rawTop = itemTop - containerHeight / 2 + itemHeight / 2
  const maxScrollTop = Math.max(0, contentHeight - containerHeight)
  return Math.max(0, Math.min(maxScrollTop, rawTop))
}

export function pickCurrentHighlightId(
  items: Array<{ id: string; pageIndex?: number }>,
  currentPageIndex?: number
) {
  if (typeof currentPageIndex !== "number") {
    return null
  }
  const matches = items.filter((item) => item.pageIndex === currentPageIndex)
  return matches.at(-1)?.id ?? null
}
