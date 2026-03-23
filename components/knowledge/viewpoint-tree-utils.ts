/**
 * 观点树工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import type { Viewpoint } from "@/src/server/store/types"

export interface ViewpointTreeNode extends Viewpoint {
  children: ViewpointTreeNode[]
}

export type ViewpointDropTarget =
  | {
      type: "before" | "after" | "inside"
      targetId: string
    }
  | {
      type: "root"
    }

export function buildViewpointTree(nodes: Viewpoint[]) {
  const map = new Map<string, ViewpointTreeNode>()
  nodes.forEach((node) => map.set(node.id, { ...node, children: [] }))
  const roots: ViewpointTreeNode[] = []
  nodes
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .forEach((node) => {
      const current = map.get(node.id)
      if (!current) {
        return
      }
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)?.children.push(current)
        return
      }
      roots.push(current)
    })
  sortTreeNodes(roots)
  return roots
}

export function moveViewpointNode(
  viewpoints: Viewpoint[],
  movement: {
    sourceId: string
    target: ViewpointDropTarget
  }
) {
  const originalTree = buildViewpointTree(viewpoints)
  const sourceNode = findTreeNode(originalTree, movement.sourceId)
  if (!sourceNode) {
    return serializeTree(buildViewpointTree(viewpoints))
  }
  if (
    movement.target.type !== "root" &&
    containsTreeNode(sourceNode, movement.target.targetId)
  ) {
    return serializeTree(originalTree)
  }

  const nextTree = buildViewpointTree(viewpoints)
  const removal = detachTreeNode(nextTree, movement.sourceId)
  if (!removal) {
    return serializeTree(nextTree)
  }

  const { node } = removal
  if (movement.target.type === "root") {
    node.parentId = undefined
    nextTree.push(node)
    return serializeTree(nextTree)
  }

  if (movement.target.type === "inside") {
    const targetNode = findTreeNode(nextTree, movement.target.targetId)
    if (!targetNode) {
      return serializeTree(buildViewpointTree(viewpoints))
    }
    node.parentId = targetNode.id
    targetNode.children.push(node)
    sortTreeNodes(nextTree)
    return serializeTree(nextTree)
  }

  const insertion = findInsertionList(nextTree, movement.target.targetId)
  if (!insertion) {
    return serializeTree(buildViewpointTree(viewpoints))
  }
  node.parentId = insertion.parentId
  const offset = movement.target.type === "before" ? 0 : 1
  insertion.list.splice(insertion.index + offset, 0, node)
  return serializeTree(nextTree)
}

export function serializeViewpointOrder(viewpoints: Viewpoint[]) {
  return serializeTree(buildViewpointTree(viewpoints)).map((item) => ({
    id: item.id,
    parentId: item.parentId,
    sortOrder: item.sortOrder
  }))
}

export function collectViewpointSubtreeIds(viewpoints: Viewpoint[], targetId: string) {
  const target = findTreeNode(buildViewpointTree(viewpoints), targetId)
  if (!target) {
    return []
  }
  const ids: string[] = []

  function walk(node: ViewpointTreeNode) {
    ids.push(node.id)
    node.children.forEach((child) => walk(child))
  }

  walk(target)
  return ids
}

function sortTreeNodes(nodes: ViewpointTreeNode[]) {
  nodes.sort((left, right) => left.sortOrder - right.sortOrder)
  nodes.forEach((node) => sortTreeNodes(node.children))
}

function findTreeNode(nodes: ViewpointTreeNode[], targetId: string): ViewpointTreeNode | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node
    }
    const child = findTreeNode(node.children, targetId)
    if (child) {
      return child
    }
  }
  return null
}

function containsTreeNode(node: ViewpointTreeNode, targetId: string): boolean {
  if (node.id === targetId) {
    return true
  }
  return node.children.some((child) => containsTreeNode(child, targetId))
}

function detachTreeNode(
  nodes: ViewpointTreeNode[],
  targetId: string
): {
  node: ViewpointTreeNode
  index: number
} | null {
  const index = nodes.findIndex((node) => node.id === targetId)
  if (index >= 0) {
    const [node] = nodes.splice(index, 1)
    return { node, index }
  }
  for (const node of nodes) {
    const detached: {
      node: ViewpointTreeNode
      index: number
    } | null = detachTreeNode(node.children, targetId)
    if (detached) {
      return detached
    }
  }
  return null
}

function findInsertionList(nodes: ViewpointTreeNode[], targetId: string): {
  list: ViewpointTreeNode[]
  index: number
  parentId?: string
} | null {
  const index = nodes.findIndex((node) => node.id === targetId)
  if (index >= 0) {
    return {
      list: nodes,
      index,
      parentId: nodes[index]?.parentId
    }
  }
  for (const node of nodes) {
    const child = findInsertionList(node.children, targetId)
    if (child) {
      return child
    }
  }
  return null
}

function serializeTree(nodes: ViewpointTreeNode[]) {
  const ordered: Viewpoint[] = []
  let sortOrder = 1

  function walk(entries: ViewpointTreeNode[], parentId?: string) {
    entries.forEach((entry) => {
      ordered.push({
        ...entry,
        parentId,
        sortOrder: sortOrder++
      })
      walk(entry.children, entry.id)
    })
  }

  walk(nodes)
  return ordered
}
