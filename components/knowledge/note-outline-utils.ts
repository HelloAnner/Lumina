/**
 * 笔记目录工具
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import type { NoteBlock } from "@/src/server/store/types"

export interface HeadingOutlineItem {
  blockId: string
  label: string
  depth: 0 | 1 | 2
}

export interface HeadingMeasure {
  blockId: string
  top: number
}

/**
 * 提取标题目录项
 */
export function buildHeadingOutlineItems(
  blocks: NoteBlock[]
): HeadingOutlineItem[] {
  const items: HeadingOutlineItem[] = []
  for (const block of blocks) {
    if (block.type !== "heading") {
      continue
    }
    items.push({
      blockId: block.id,
      label: block.text || `标题 ${block.level}`,
      depth: toHeadingDepth(block.level)
    })
  }
  return items
}

/**
 * 根据滚动位置解析当前标题
 */
export function resolveActiveHeadingId(
  measures: HeadingMeasure[],
  scrollTop: number
): string | undefined {
  if (measures.length === 0) {
    return undefined
  }
  const pivot = scrollTop + 120
  let activeId = measures[0].blockId
  for (const item of measures) {
    if (item.top > pivot) {
      break
    }
    activeId = item.blockId
  }
  return activeId
}

function toHeadingDepth(level: number): 0 | 1 | 2 {
  if (level <= 1) {
    return 0
  }
  if (level === 2) {
    return 1
  }
  return 2
}
