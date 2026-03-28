/**
 * 笔记编辑器块命令定义
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import type { NoteBlock } from "@/src/server/store/types"

export type NoteEditorCommandGroup = "basic" | "turn-into"

export interface NoteEditorCommand {
  key: string
  label: string
  description: string
  icon: string
  group: NoteEditorCommandGroup
  createBlock: (id: string, sortOrder: number) => NoteBlock
  transformBlock: (block: NoteBlock) => NoteBlock
  keywords: string[]
}

const TEXT_BLOCK = {
  paragraph(block: NoteBlock) {
    return "text" in block ? block.text : "code" in block ? block.code : ""
  },
  richText(block: NoteBlock) {
    return "richText" in block ? block.richText : undefined
  }
}

export const NOTE_EDITOR_COMMANDS: NoteEditorCommand[] = [
  createCommand({
    key: "paragraph",
    label: "段落",
    description: "正文文本",
    icon: "pilcrow",
    keywords: ["paragraph", "duanluo", "dl", "text"],
    createBlock: (id, sortOrder) => ({ id, type: "paragraph", text: "", sortOrder }),
    transformBlock: (block) => ({
      id: block.id,
      type: "paragraph",
      text: TEXT_BLOCK.paragraph(block),
      richText: TEXT_BLOCK.richText(block),
      sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "heading-1",
    label: "标题 1",
    description: "大标题",
    icon: "heading-1",
    group: "turn-into",
    keywords: ["heading", "h1", "bt1", "title"],
    createBlock: (id, sortOrder) => ({ id, type: "heading", level: 1, text: "", sortOrder }),
    transformBlock: (block) => createHeadingBlock(block, 1)
  }),
  createCommand({
    key: "heading-2",
    label: "标题 2",
    description: "中标题",
    icon: "heading-2",
    group: "turn-into",
    keywords: ["heading", "h2", "bt2", "title"],
    createBlock: (id, sortOrder) => ({ id, type: "heading", level: 2, text: "", sortOrder }),
    transformBlock: (block) => createHeadingBlock(block, 2)
  }),
  createCommand({
    key: "heading-3",
    label: "标题 3",
    description: "小标题",
    icon: "heading-3",
    group: "turn-into",
    keywords: ["heading", "h3", "bt3", "title"],
    createBlock: (id, sortOrder) => ({ id, type: "heading", level: 3, text: "", sortOrder }),
    transformBlock: (block) => createHeadingBlock(block, 3)
  }),
  createCommand({
    key: "quote",
    label: "引用",
    description: "原文引用块",
    icon: "quote",
    keywords: ["quote", "yinyong", "yy", "blockquote"],
    createBlock: (id, sortOrder) => ({ id, type: "quote", text: "", sortOrder }),
    transformBlock: (block) => ({
      id: block.id,
      type: "quote",
      text: TEXT_BLOCK.paragraph(block),
      richText: TEXT_BLOCK.richText(block),
      sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "insight",
    label: "洞察",
    description: "AI 补充说明",
    icon: "lightbulb",
    keywords: ["insight", "dongcha", "dc", "ai"],
    createBlock: (id, sortOrder) => ({ id, type: "insight", text: "", sortOrder }),
    transformBlock: (block) => ({
      id: block.id,
      type: "insight",
      text: TEXT_BLOCK.paragraph(block),
      richText: TEXT_BLOCK.richText(block),
      sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "highlight",
    label: "高亮",
    description: "关键洞察标注",
    icon: "highlighter",
    keywords: ["highlight", "gaoliang", "gl", "key"],
    createBlock: (id, sortOrder) => ({ id, type: "highlight", text: "", sortOrder }),
    transformBlock: (block) => ({
      id: block.id,
      type: "highlight",
      text: TEXT_BLOCK.paragraph(block),
      richText: TEXT_BLOCK.richText(block),
      sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "bullet-list",
    label: "无序列表",
    description: "项目符号列表",
    icon: "list",
    keywords: ["bullet", "list", "wuxu", "wxlb", "liebiao", "ul"],
    createBlock: (id, sortOrder) => ({
      id, type: "bullet-list", items: [{ text: "" }], sortOrder
    }),
    transformBlock: (block) => ({
      id: block.id,
      type: "bullet-list",
      items: [{ text: TEXT_BLOCK.paragraph(block), richText: TEXT_BLOCK.richText(block) }],
      sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "ordered-list",
    label: "有序列表",
    description: "编号列表",
    icon: "list-ordered",
    keywords: ["ordered", "number", "youxu", "yxlb", "bianhao", "ol"],
    createBlock: (id, sortOrder) => ({
      id, type: "ordered-list", items: [{ text: "" }], sortOrder
    }),
    transformBlock: (block) => ({
      id: block.id,
      type: "ordered-list",
      items: [{ text: TEXT_BLOCK.paragraph(block), richText: TEXT_BLOCK.richText(block) }],
      sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "task-list",
    label: "待办列表",
    description: "可勾选的任务列表",
    icon: "list-checks",
    keywords: ["task", "todo", "daiban", "dblb", "checkbox"],
    createBlock: (id, sortOrder) => ({
      id, type: "task-list", items: [{ text: "", checked: false }], sortOrder
    }),
    transformBlock: (block) => ({
      id: block.id,
      type: "task-list",
      items: [{ text: TEXT_BLOCK.paragraph(block), richText: TEXT_BLOCK.richText(block), checked: false }],
      sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "code",
    label: "代码",
    description: "代码块",
    icon: "code",
    keywords: ["code", "daima", "dm"],
    createBlock: (id, sortOrder) => ({ id, type: "code", code: "", language: "", sortOrder }),
    transformBlock: (block) => ({
      id: block.id,
      type: "code",
      code: TEXT_BLOCK.paragraph(block),
      language: block.type === "code" ? block.language : "",
      sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "image",
    label: "图片",
    description: "上传或嵌入图片",
    icon: "image",
    keywords: ["image", "tupian", "tp", "img", "photo"],
    createBlock: (id, sortOrder) => ({
      id, type: "image", objectKey: "", originalName: "", sortOrder
    }),
    transformBlock: (block) => ({
      id: block.id, type: "image", objectKey: "", originalName: "", sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "callout",
    label: "提示块",
    description: "带图标的提示/警告块",
    icon: "info",
    keywords: ["callout", "tishi", "tsk", "alert", "info", "warning"],
    createBlock: (id, sortOrder) => ({
      id, type: "callout", calloutType: "info", title: "", foldable: false,
      defaultFolded: false, children: [{ id: crypto.randomUUID(), type: "paragraph", text: "", sortOrder: 0 }],
      sortOrder
    }),
    transformBlock: (block) => ({
      id: block.id, type: "callout", calloutType: "info", title: "", foldable: false,
      defaultFolded: false,
      children: [{ id: crypto.randomUUID(), type: "paragraph", text: TEXT_BLOCK.paragraph(block), richText: TEXT_BLOCK.richText(block), sortOrder: 0 }],
      sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "toggle",
    label: "折叠块",
    description: "可折叠/展开的内容块",
    icon: "chevron-right",
    keywords: ["toggle", "zhedie", "zdq", "collapse", "fold"],
    createBlock: (id, sortOrder) => ({
      id, type: "toggle", title: "Toggle", children: [{ id: crypto.randomUUID(), type: "paragraph", text: "", sortOrder: 0 }],
      sortOrder
    }),
    transformBlock: (block) => ({
      id: block.id, type: "toggle", title: TEXT_BLOCK.paragraph(block),
      children: [{ id: crypto.randomUUID(), type: "paragraph", text: "", sortOrder: 0 }],
      sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "table",
    label: "表格",
    description: "可编辑表格",
    icon: "table",
    keywords: ["table", "biaoge", "bg"],
    createBlock: (id, sortOrder) => ({
      id, type: "table", headers: ["列 1", "列 2", "列 3"],
      rows: [["", "", ""], ["", "", ""]],
      alignments: ["left", "left", "left"], sortOrder
    }),
    transformBlock: (block) => ({
      id: block.id, type: "table", headers: ["列 1", "列 2", "列 3"],
      rows: [[TEXT_BLOCK.paragraph(block), "", ""]],
      alignments: ["left", "left", "left"], sortOrder: block.sortOrder
    })
  }),
  createCommand({
    key: "divider",
    label: "分隔线",
    description: "水平分割线",
    icon: "minus",
    keywords: ["divider", "fengexian", "fgx", "line", "hr"],
    createBlock: (id, sortOrder) => ({ id, type: "divider", sortOrder }),
    transformBlock: (block) => ({ id: block.id, type: "divider", sortOrder: block.sortOrder })
  })
]

export function filterNoteEditorCommands(query: string): NoteEditorCommand[] {
  if (!query) {
    return NOTE_EDITOR_COMMANDS
  }
  const normalized = query.toLowerCase()
  return NOTE_EDITOR_COMMANDS.filter((command) =>
    command.label.toLowerCase().includes(normalized) ||
    command.key.includes(normalized) ||
    command.keywords.some((keyword) => keyword.includes(normalized))
  )
}

export function findNoteEditorCommand(key: string): NoteEditorCommand | undefined {
  return NOTE_EDITOR_COMMANDS.find((command) => command.key === key)
}

function createCommand(input: Omit<NoteEditorCommand, "group"> & { group?: NoteEditorCommandGroup }) {
  return {
    group: "basic" as const,
    ...input
  }
}

function createHeadingBlock(block: NoteBlock, level: 1 | 2 | 3): NoteBlock {
  return {
    id: block.id,
    type: "heading",
    level,
    text: TEXT_BLOCK.paragraph(block),
    richText: TEXT_BLOCK.richText(block),
    sortOrder: block.sortOrder
  }
}
