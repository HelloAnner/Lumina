/**
 * 阅读器目录树工具测试
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  buildSidebarTree,
  normalizeSidebarTitle
} from "@/components/reader/reader-sidebar-utils"

test("normalizeSidebarTitle 会把 cover 与 text 标题规整成人类可读名称", () => {
  assert.equal(normalizeSidebarTitle("cover", "默认标题", 0), "封面")
  assert.equal(normalizeSidebarTitle("text001", "默认标题", 1), "扉页")
  assert.equal(normalizeSidebarTitle("正文标题", "默认标题", 2), "正文标题")
})

test("buildSidebarTree 会把章节挂到最近的部分节点下", () => {
  const tree = buildSidebarTree([
    {
      id: "part-1",
      title: "第一部分 开始",
      sourceIndex: 0
    },
    {
      id: "chapter-1",
      title: "第1章 起步",
      sourceIndex: 1
    },
    {
      id: "chapter-2",
      title: "第2章 深入",
      sourceIndex: 2
    }
  ])

  assert.equal(tree.length, 1)
  assert.equal(tree[0].children.length, 2)
  assert.equal(tree[0].children[0].title, "第1章 起步")
  assert.equal(tree[0].children[1].title, "第2章 深入")
})
