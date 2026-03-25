/**
 * 块类型注册表
 * 定义用户可手动创建的笔记块类型及其默认内容
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */

import type { NoteBlockType } from "@/src/server/store/types"

export interface BlockTypeEntry {
  type: NoteBlockType
  label: string
  description: string
  /** lucide 图标名 */
  icon: string
  /** 搜索关键词（含拼音首字母） */
  keywords: string[]
  /** 生成默认块内容（不含 id 和 sortOrder） */
  createDefault: () => Record<string, unknown>
}

export const BLOCK_TYPE_REGISTRY: BlockTypeEntry[] = [
  {
    type: "heading",
    label: "标题",
    description: "插入标题文本",
    icon: "heading",
    keywords: ["heading", "bt", "biaoti", "h2", "title"],
    createDefault: () => ({ type: "heading", level: 2, text: "" }),
  },
  {
    type: "paragraph",
    label: "段落",
    description: "插入正文段落",
    icon: "pilcrow",
    keywords: ["paragraph", "dl", "duanluo", "text", "wenzi"],
    createDefault: () => ({ type: "paragraph", text: "" }),
  },
  {
    type: "quote",
    label: "引用",
    description: "插入原文引用块",
    icon: "quote",
    keywords: ["quote", "yy", "yinyong", "blockquote"],
    createDefault: () => ({ type: "quote", text: "" }),
  },
  {
    type: "code",
    label: "代码",
    description: "插入代码块",
    icon: "code",
    keywords: ["code", "dm", "daima"],
    createDefault: () => ({ type: "code", code: "", language: "" }),
  },
  {
    type: "divider",
    label: "分隔线",
    description: "插入水平分割线",
    icon: "minus",
    keywords: ["divider", "fgx", "fengexian", "hr", "line"],
    createDefault: () => ({ type: "divider" }),
  },
  {
    type: "insight",
    label: "洞察",
    description: "AI 补充说明",
    icon: "lightbulb",
    keywords: ["insight", "dc", "dongcha", "ai", "bulb"],
    createDefault: () => ({ type: "insight", text: "" }),
  },
  {
    type: "highlight",
    label: "高亮",
    description: "关键洞察标注",
    icon: "highlighter",
    keywords: ["highlight", "gl", "gaoliang", "key"],
    createDefault: () => ({ type: "highlight", text: "" }),
  },
]

/** 根据查询过滤块类型 */
export function filterBlockTypes(query: string): BlockTypeEntry[] {
  if (!query) {
    return BLOCK_TYPE_REGISTRY
  }
  const q = query.toLowerCase()
  return BLOCK_TYPE_REGISTRY.filter(
    (entry) =>
      entry.label.includes(q) ||
      entry.type.includes(q) ||
      entry.keywords.some((kw) => kw.includes(q))
  )
}
