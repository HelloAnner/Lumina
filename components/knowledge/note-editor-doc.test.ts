/**
 * 笔记编辑器文档转换测试
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import type { NoteBlock } from "@/src/server/store/types"
import {
  blocksToTipTapDoc,
  duplicateBlockInDoc,
  insertBlockAfterInDoc,
  moveBlockInDoc,
  tipTapDocToBlocks
} from "@/components/knowledge/note-editor-doc"

test("blocksToTipTapDoc 与 tipTapDocToBlocks 会保留富文本与特色块属性", () => {
  const blocks: NoteBlock[] = [
    {
      id: "heading-1",
      type: "heading",
      level: 1,
      text: "第一性原理",
      richText: [
        { text: "第一性" },
        {
          text: "原理",
          marks: [{ type: "bold" }, { type: "highlight" }]
        }
      ],
      sortOrder: 2
    },
    {
      id: "quote-1",
      type: "quote",
      text: "每一个正确答案都必然是大多数人没有想到的。",
      richText: [
        { text: "每一个正确答案都必然是" },
        { text: "大多数人", marks: [{ type: "italic" }] },
        { text: "没有想到的。" }
      ],
      sourceBookTitle: "从 0 到 1",
      sourceLocation: "第 3 章",
      highlightId: "hl-1",
      sortOrder: 1
    },
    {
      id: "code-1",
      type: "code",
      code: "const answer = 42",
      language: "ts",
      sortOrder: 3
    },
    {
      id: "image-1",
      type: "image",
      objectKey: "images/note.png",
      originalName: "note.png",
      alt: "示意图",
      sortOrder: 4
    }
  ]

  const doc = blocksToTipTapDoc(blocks)
  const nextBlocks = tipTapDocToBlocks(doc)

  assert.deepEqual(nextBlocks, [
    {
      id: "quote-1",
      type: "quote",
      text: "每一个正确答案都必然是大多数人没有想到的。",
      richText: [
        { text: "每一个正确答案都必然是" },
        { text: "大多数人", marks: [{ type: "italic" }] },
        { text: "没有想到的。" }
      ],
      sourceBookTitle: "从 0 到 1",
      sourceLocation: "第 3 章",
      highlightId: "hl-1",
      sortOrder: 0
    },
    {
      id: "heading-1",
      type: "heading",
      level: 1,
      text: "第一性原理",
      richText: [
        { text: "第一性" },
        {
          text: "原理",
          marks: [{ type: "bold" }, { type: "highlight" }]
        }
      ],
      sortOrder: 1
    },
    {
      id: "code-1",
      type: "code",
      code: "const answer = 42",
      language: "ts",
      sortOrder: 2
    },
    {
      id: "image-1",
      type: "image",
      objectKey: "images/note.png",
      originalName: "note.png",
      alt: "示意图",
      sortOrder: 3
    }
  ])
})

test("blocksToTipTapDoc 会为旧数据自动降级为单段纯文本", () => {
  const doc = blocksToTipTapDoc([
    {
      id: "paragraph-1",
      type: "paragraph",
      text: "旧版纯文本",
      sortOrder: 0
    }
  ])

  assert.deepEqual(doc.content?.[0], {
    type: "paragraph",
    attrs: { blockId: "paragraph-1" },
    content: [{ type: "text", text: "旧版纯文本" }]
  })
})

test("blocksToTipTapDoc 会把紧跟引用后的 insight 折叠为组合展示", () => {
  const blocks: NoteBlock[] = [
    {
      id: "quote-1",
      type: "quote",
      text: "引用正文",
      sourceBookTitle: "原则",
      sourceLocation: "P.12",
      sortOrder: 0
    },
    {
      id: "insight-1",
      type: "insight",
      text: "这是我的观点备注",
      label: "观点备注",
      sortOrder: 1
    }
  ]

  const doc = blocksToTipTapDoc(blocks)

  assert.equal(doc.content?.length, 1)
  assert.equal(doc.content?.[0]?.type, "quoteBlock")
  assert.equal(doc.content?.[0]?.attrs?.pairedInsightBlockId, "insight-1")
  assert.equal(doc.content?.[0]?.attrs?.pairedInsightText, "这是我的观点备注")
  assert.deepEqual(tipTapDocToBlocks(doc), [
    {
      id: "quote-1",
      type: "quote",
      text: "引用正文",
      sourceBookTitle: "原则",
      sourceLocation: "P.12",
      highlightId: undefined,
      richText: [{ text: "引用正文" }],
      sortOrder: 0
    },
    {
      id: "insight-1",
      type: "insight",
      text: "这是我的观点备注",
      label: "观点备注",
      richText: [{ text: "这是我的观点备注" }],
      sortOrder: 1
    }
  ])
})

test("moveBlockInDoc 会按目标块前后重排顶层块", () => {
  const doc = blocksToTipTapDoc([
    { id: "a", type: "paragraph", text: "A", sortOrder: 0 },
    { id: "b", type: "paragraph", text: "B", sortOrder: 1 },
    { id: "c", type: "paragraph", text: "C", sortOrder: 2 }
  ])

  const moved = moveBlockInDoc(doc, "c", "a", "before")

  assert.deepEqual(
    tipTapDocToBlocks(moved).map((block) => block.id),
    ["c", "a", "b"]
  )
})

test("duplicateBlockInDoc 与 insertBlockAfterInDoc 会生成新块并保持原块内容", () => {
  const doc = blocksToTipTapDoc([
    { id: "a", type: "paragraph", text: "A", sortOrder: 0 },
    { id: "b", type: "paragraph", text: "B", sortOrder: 1 }
  ])

  const duplicated = duplicateBlockInDoc(doc, "a", "a-copy")
  const inserted = insertBlockAfterInDoc(duplicated, "b", {
    type: "paragraph",
    attrs: { blockId: "c" },
    content: [{ type: "text", text: "C" }]
  })

  assert.deepEqual(
    tipTapDocToBlocks(inserted).map((block) => ({
      id: block.id,
      text: "text" in block ? block.text : ""
    })),
    [
      { id: "a", text: "A" },
      { id: "a-copy", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" }
    ]
  )
})
