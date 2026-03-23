/**
 * 观点树工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import type { Viewpoint } from "@/src/server/store/types"
import {
  buildViewpointTree,
  moveViewpointNode,
  serializeViewpointOrder
} from "@/components/knowledge/viewpoint-tree-utils"

function createViewpoint(
  id: string,
  title: string,
  sortOrder: number,
  parentId?: string
): Viewpoint {
  return {
    id,
    userId: "user-1",
    title,
    parentId,
    isFolder: false,
    isCandidate: false,
    sortOrder,
    highlightCount: 0,
    articleContent: "",
    relatedBookIds: [],
    createdAt: "2026-03-23T00:00:00.000Z"
  }
}

test("buildViewpointTree 会按 parentId 组织嵌套关系", () => {
  const tree = buildViewpointTree([
    createViewpoint("root", "根观点", 1),
    createViewpoint("child", "子观点", 2, "root")
  ])

  assert.equal(tree.length, 1)
  assert.equal(tree[0].children.length, 1)
  assert.equal(tree[0].children[0].id, "child")
})

test("moveViewpointNode 支持把节点插入到目标节点之后", () => {
  const moved = moveViewpointNode(
    [
      createViewpoint("a", "A", 1),
      createViewpoint("b", "B", 2),
      createViewpoint("c", "C", 3)
    ],
    {
      sourceId: "a",
      target: {
        type: "after",
        targetId: "c"
      }
    }
  )

  assert.deepEqual(serializeViewpointOrder(moved), [
    { id: "b", parentId: undefined, sortOrder: 1 },
    { id: "c", parentId: undefined, sortOrder: 2 },
    { id: "a", parentId: undefined, sortOrder: 3 }
  ])
})

test("moveViewpointNode 支持把节点放到另一个节点下面", () => {
  const moved = moveViewpointNode(
    [
      createViewpoint("a", "A", 1),
      createViewpoint("b", "B", 2),
      createViewpoint("c", "C", 3)
    ],
    {
      sourceId: "c",
      target: {
        type: "inside",
        targetId: "a"
      }
    }
  )

  assert.deepEqual(serializeViewpointOrder(moved), [
    { id: "a", parentId: undefined, sortOrder: 1 },
    { id: "c", parentId: "a", sortOrder: 2 },
    { id: "b", parentId: undefined, sortOrder: 3 }
  ])
})

test("moveViewpointNode 支持把节点拖到根目录底部", () => {
  const moved = moveViewpointNode(
    [
      createViewpoint("a", "A", 1),
      createViewpoint("b", "B", 2, "a"),
      createViewpoint("c", "C", 3)
    ],
    {
      sourceId: "b",
      target: {
        type: "root"
      }
    }
  )

  assert.deepEqual(serializeViewpointOrder(moved), [
    { id: "a", parentId: undefined, sortOrder: 1 },
    { id: "c", parentId: undefined, sortOrder: 2 },
    { id: "b", parentId: undefined, sortOrder: 3 }
  ])
})

test("moveViewpointNode 不允许把节点放到自己的子节点下面", () => {
  const original = [
    createViewpoint("a", "A", 1),
    createViewpoint("b", "B", 2, "a")
  ]

  const moved = moveViewpointNode(original, {
    sourceId: "a",
    target: {
      type: "inside",
      targetId: "b"
    }
  })

  assert.deepEqual(serializeViewpointOrder(moved), [
    { id: "a", parentId: undefined, sortOrder: 1 },
    { id: "b", parentId: "a", sortOrder: 2 }
  ])
})
