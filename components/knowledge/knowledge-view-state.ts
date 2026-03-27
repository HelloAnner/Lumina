/**
 * 知识库观点切换视图状态工具
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import type { Viewpoint } from "@/src/server/store/types"

export function shouldRenderViewpointEditor(input: {
  selectedId: string
  readyViewpointId: string
}) {
  if (!input.selectedId) {
    return false
  }
  return input.selectedId === input.readyViewpointId
}

export function shouldBootstrapEmptyViewpoint(input: {
  selectedId: string
  readyViewpointId: string
  blockCount: number
}) {
  return shouldRenderViewpointEditor({
    selectedId: input.selectedId,
    readyViewpointId: input.readyViewpointId
  }) && input.blockCount === 0
}

export function buildViewpointPrefetchOrder(
  viewpoints: Viewpoint[],
  selectedId: string,
  limit = 6
) {
  const candidates = viewpoints.filter((item) => !item.isFolder)
  if (candidates.length === 0) {
    return []
  }
  const selectedIndex = candidates.findIndex((item) => item.id === selectedId)
  if (selectedIndex < 0) {
    return candidates.slice(0, limit).map((item) => item.id)
  }
  const result: string[] = []
  for (let distance = 1; result.length < limit && distance < candidates.length; distance += 1) {
    const next = candidates[selectedIndex + distance]
    if (next) {
      result.push(next.id)
      if (result.length >= limit) {
        break
      }
    }
    const prev = candidates[selectedIndex - distance]
    if (prev) {
      result.push(prev.id)
    }
  }
  return result.slice(0, limit)
}
