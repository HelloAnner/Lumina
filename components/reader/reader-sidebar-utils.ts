/**
 * 阅读器目录树工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import type { SidebarNode } from "@/components/reader/reader-types"

export function normalizeSidebarTitle(title: string, fallback: string, index: number) {
  if (/^cover$/i.test(title)) {
    return "封面"
  }
  if (/^text\d+$/i.test(title)) {
    return index === 1 ? "扉页" : fallback
  }
  return title
}

function inferSidebarLevel(title: string, fallbackLevel = 0) {
  if (/^第[一二三四五六七八九十0-9]+部分/.test(title)) {
    return 0
  }
  if (/^第\s*\d+\s*章/.test(title) || /^图\d+/.test(title)) {
    return 1
  }
  if (["目录", "图片来源", "致谢", "注释", "封面", "扉页"].includes(title)) {
    return 0
  }
  return fallbackLevel
}

export function buildSidebarTree(
  entries: Array<{
    id: string
    title: string
    sourceIndex: number
    level?: number
  }>
) {
  const roots: SidebarNode[] = []
  let currentParent: SidebarNode | null = null
  let fallbackParent: SidebarNode | null = null

  entries.forEach((entry) => {
    const level = inferSidebarLevel(entry.title, entry.level ?? 0)
    const node: SidebarNode = {
      id: entry.id,
      title: entry.title,
      sourceIndex: entry.sourceIndex,
      level,
      children: []
    }
    if (
      level === 1 &&
      currentParent &&
      !["目录", "封面", "扉页"].includes(currentParent.title)
    ) {
      currentParent.children.push(node)
    } else if (level === 1) {
      if (!fallbackParent) {
        fallbackParent = {
          id: "__body__",
          title: "正文",
          sourceIndex: node.sourceIndex,
          level: 0,
          children: []
        }
        roots.push(fallbackParent)
      }
      fallbackParent.children.push(node)
    } else {
      roots.push(node)
      currentParent = node
    }
  })

  return roots
}
