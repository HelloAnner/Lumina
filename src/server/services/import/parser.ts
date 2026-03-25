/**
 * Obsidian Markdown → NoteBlock 解析器
 * 将 Obsidian 风格的 Markdown 无损转换为结构化块序列
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
import { randomUUID } from "node:crypto"
import type {
  NoteBlock,
  HeadingBlock,
  ParagraphBlock,
  QuoteBlock,
  CodeBlock,
  DividerBlock,
  ImageBlock,
  CalloutBlock,
  TaskBlock,
  TaskItem,
  TableBlock,
  MermaidBlock,
  MathBlock,
  ExcalidrawBlock
} from "@/src/server/store/types"

interface ParseResult {
  frontmatter: Record<string, unknown>
  blocks: NoteBlock[]
  tags: string[]
  wikilinks: string[]
  imageRefs: string[]
  excalidrawRefs: string[]
}

/** 解析 Obsidian Markdown 文件全文 */
export function parseObsidianMarkdown(rawMarkdown: string): ParseResult {
  const { frontmatter, body } = extractFrontmatter(rawMarkdown)
  const tags = extractTags(rawMarkdown, frontmatter)
  const wikilinks = extractWikilinks(body)
  const imageRefs: string[] = []
  const excalidrawRefs: string[] = []

  const lines = body.split("\n")
  const blocks: NoteBlock[] = []
  let sortOrder = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 空行跳过
    if (line.trim() === "") {
      i++
      continue
    }

    // Obsidian 注释 %%...%%
    if (line.trim().startsWith("%%")) {
      i = skipComment(lines, i)
      continue
    }

    // 分隔线
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ id: randomUUID(), type: "divider", sortOrder: sortOrder++ } as DividerBlock)
      i++
      continue
    }

    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3
      blocks.push({
        id: randomUUID(),
        type: "heading",
        sortOrder: sortOrder++,
        level,
        text: headingMatch[2].trim()
      } as HeadingBlock)
      i++
      continue
    }

    // 数学公式块 $$...$$
    if (line.trim().startsWith("$$")) {
      const { block, nextIndex } = parseMathBlock(lines, i, sortOrder++)
      blocks.push(block)
      i = nextIndex
      continue
    }

    // 代码块（含 mermaid）
    if (line.trim().startsWith("```")) {
      const { block, nextIndex } = parseCodeBlock(lines, i, sortOrder++)
      blocks.push(block)
      i = nextIndex
      continue
    }

    // Callout 或引用块
    if (line.trim().startsWith(">")) {
      const calloutMatch = line.match(/^>\s*\[!(\w+)\]([+-]?)(.*)/)
      if (calloutMatch) {
        const { block, nextIndex } = parseCallout(lines, i, sortOrder++)
        blocks.push(block)
        i = nextIndex
      } else {
        const { block, nextIndex } = parseQuote(lines, i, sortOrder++)
        blocks.push(block)
        i = nextIndex
      }
      continue
    }

    // 任务列表
    if (/^(\s*)- \[.\]/.test(line)) {
      const { block, nextIndex } = parseTaskBlock(lines, i, sortOrder++)
      blocks.push(block)
      i = nextIndex
      continue
    }

    // 表格
    if (line.includes("|") && i + 1 < lines.length && /^\|?[\s-:|]+\|/.test(lines[i + 1])) {
      const { block, nextIndex } = parseTable(lines, i, sortOrder++)
      blocks.push(block)
      i = nextIndex
      continue
    }

    // 图片
    const obsidianImg = line.match(/^!\[\[(.+?)(\|(\d+))?\]\]\s*$/)
    if (obsidianImg) {
      const ref = obsidianImg[1]
      const width = obsidianImg[3] ? parseInt(obsidianImg[3], 10) : undefined
      if (ref.endsWith(".excalidraw")) {
        excalidrawRefs.push(ref)
        blocks.push({
          id: randomUUID(),
          type: "excalidraw",
          sortOrder: sortOrder++,
          sourcePath: ref,
          fallbackText: `[Excalidraw: ${ref}]`
        } as ExcalidrawBlock)
      } else {
        imageRefs.push(ref)
        blocks.push({
          id: randomUUID(),
          type: "image",
          sortOrder: sortOrder++,
          objectKey: "",
          originalName: ref.split("/").pop() ?? ref,
          alt: "",
          displayWidth: width
        } as ImageBlock)
      }
      i++
      continue
    }

    const mdImg = line.match(/^!\[([^\]]*)\]\((.+?)\)\s*$/)
    if (mdImg) {
      const alt = mdImg[1]
      const src = mdImg[2]
      if (src.startsWith("http://") || src.startsWith("https://")) {
        blocks.push({
          id: randomUUID(),
          type: "image",
          sortOrder: sortOrder++,
          objectKey: "",
          externalUrl: src,
          originalName: src.split("/").pop() ?? "image",
          alt
        } as ImageBlock)
      } else {
        imageRefs.push(src)
        blocks.push({
          id: randomUUID(),
          type: "image",
          sortOrder: sortOrder++,
          objectKey: "",
          originalName: src.split("/").pop() ?? "image",
          alt
        } as ImageBlock)
      }
      i++
      continue
    }

    // 非图片嵌入 ![[note]]
    const embedMatch = line.match(/^!\[\[(.+?)\]\]\s*$/)
    if (embedMatch && !embedMatch[1].match(/\.(png|jpg|jpeg|gif|svg|webp|bmp|excalidraw)/i)) {
      blocks.push({
        id: randomUUID(),
        type: "paragraph",
        sortOrder: sortOrder++,
        text: `[嵌入: ${embedMatch[1]}]`
      } as ParagraphBlock)
      i++
      continue
    }

    // 普通段落（收集连续的非空行）
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({
        id: randomUUID(),
        type: "paragraph",
        sortOrder: sortOrder++,
        text: paraLines.join("\n")
      } as ParagraphBlock)
    }
  }

  return { frontmatter, blocks, tags, wikilinks, imageRefs, excalidrawRefs }
}

/** 判断一行是否是新块的开始 */
function isBlockStart(line: string): boolean {
  if (line.trim() === "") {
    return true
  }
  if (/^#{1,6}\s/.test(line)) {
    return true
  }
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
    return true
  }
  if (line.trim().startsWith("```")) {
    return true
  }
  if (line.trim().startsWith(">")) {
    return true
  }
  if (/^(\s*)- \[.\]/.test(line)) {
    return true
  }
  if (line.trim().startsWith("$$")) {
    return true
  }
  if (/^!\[/.test(line)) {
    return true
  }
  // 表格开始（含 |）
  if (line.includes("|") && line.trim().startsWith("|")) {
    return true
  }
  return false
}

/** 提取 frontmatter */
function extractFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  if (!fmMatch) {
    return { frontmatter: {}, body: raw }
  }
  const fmBlock = fmMatch[1]
  const body = raw.slice(fmMatch[0].length)
  const frontmatter: Record<string, unknown> = {}
  for (const line of fmBlock.split("\n")) {
    const kv = line.match(/^(\w[\w\s]*?):\s*(.*)/)
    if (kv) {
      const key = kv[1].trim()
      let value: unknown = kv[2].trim()
      if (value === "true") {
        value = true
      } else if (value === "false") {
        value = false
      } else if (typeof value === "string" && value.startsWith("[")) {
        try {
          value = JSON.parse(value)
        } catch {
          // 保持原始字符串
        }
      }
      frontmatter[key] = value
    }
  }
  return { frontmatter, body }
}

/** 提取标签 */
function extractTags(raw: string, fm: Record<string, unknown>): string[] {
  const tags = new Set<string>()
  // 从 frontmatter
  const fmTags = fm.tags ?? fm.tag
  if (Array.isArray(fmTags)) {
    fmTags.forEach((t) => tags.add(String(t)))
  } else if (typeof fmTags === "string") {
    fmTags.split(",").forEach((t) => tags.add(t.trim()))
  }
  if (typeof fm.category === "string") {
    tags.add(fm.category)
  }
  // 从正文 #tag
  const tagMatches = raw.match(/(?:^|\s)#([\w/\u4e00-\u9fff]+)/g)
  if (tagMatches) {
    tagMatches.forEach((m) => tags.add(m.trim().slice(1)))
  }
  return [...tags].filter(Boolean)
}

/** 提取 wikilinks */
function extractWikilinks(body: string): string[] {
  const links = new Set<string>()
  const matches = body.match(/\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g)
  if (matches) {
    matches.forEach((m) => {
      const target = m.match(/\[\[([^\]|]+)/)?.[1]
      if (target && !target.match(/\.(png|jpg|jpeg|gif|svg|webp|bmp|excalidraw)/i)) {
        links.add(target)
      }
    })
  }
  return [...links]
}

/** 跳过 Obsidian 注释 */
function skipComment(lines: string[], start: number): number {
  const firstLine = lines[start].trim()
  if (firstLine.startsWith("%%") && firstLine.endsWith("%%") && firstLine.length > 4) {
    return start + 1
  }
  let i = start + 1
  while (i < lines.length) {
    if (lines[i].trim().endsWith("%%")) {
      return i + 1
    }
    i++
  }
  return i
}

/** 解析代码块（含 mermaid） */
function parseCodeBlock(
  lines: string[],
  start: number,
  sortOrder: number
): { block: NoteBlock; nextIndex: number } {
  const langMatch = lines[start].match(/^```(\w*)/)
  const language = langMatch?.[1] || ""
  const codeLines: string[] = []
  let i = start + 1
  while (i < lines.length && !lines[i].trim().startsWith("```")) {
    codeLines.push(lines[i])
    i++
  }
  const code = codeLines.join("\n")
  const nextIndex = i < lines.length ? i + 1 : i

  if (language === "mermaid") {
    return {
      block: { id: randomUUID(), type: "mermaid", sortOrder, code } as MermaidBlock,
      nextIndex
    }
  }

  return {
    block: { id: randomUUID(), type: "code", sortOrder, language, code } as CodeBlock,
    nextIndex
  }
}

/** 解析数学公式块 */
function parseMathBlock(
  lines: string[],
  start: number,
  sortOrder: number
): { block: MathBlock; nextIndex: number } {
  const firstLine = lines[start].trim()
  // 单行 $$ ... $$
  if (firstLine.startsWith("$$") && firstLine.endsWith("$$") && firstLine.length > 4) {
    return {
      block: {
        id: randomUUID(),
        type: "math",
        sortOrder,
        latex: firstLine.slice(2, -2).trim(),
        inline: false
      },
      nextIndex: start + 1
    }
  }

  const mathLines: string[] = []
  let i = start + 1
  while (i < lines.length && !lines[i].trim().startsWith("$$")) {
    mathLines.push(lines[i])
    i++
  }
  return {
    block: {
      id: randomUUID(),
      type: "math",
      sortOrder,
      latex: mathLines.join("\n"),
      inline: false
    },
    nextIndex: i < lines.length ? i + 1 : i
  }
}

/** 解析引用块 */
function parseQuote(
  lines: string[],
  start: number,
  sortOrder: number
): { block: QuoteBlock; nextIndex: number } {
  const quoteLines: string[] = []
  let i = start
  while (i < lines.length && lines[i].trim().startsWith(">")) {
    quoteLines.push(lines[i].replace(/^>\s?/, ""))
    i++
  }
  return {
    block: {
      id: randomUUID(),
      type: "quote",
      sortOrder,
      text: quoteLines.join("\n").trim()
    },
    nextIndex: i
  }
}

/** 解析 Callout 块 */
function parseCallout(
  lines: string[],
  start: number,
  sortOrder: number
): { block: CalloutBlock; nextIndex: number } {
  const headerMatch = lines[start].match(/^>\s*\[!(\w+)\]([+-]?)\s*(.*)/)
  const calloutType = headerMatch?.[1] ?? "note"
  const foldMark = headerMatch?.[2] ?? ""
  const title = headerMatch?.[3]?.trim() || undefined

  const foldable = foldMark === "+" || foldMark === "-"
  const defaultFolded = foldMark === "-"

  const contentLines: string[] = []
  let i = start + 1
  while (i < lines.length && lines[i].startsWith(">")) {
    contentLines.push(lines[i].replace(/^>\s?/, ""))
    i++
  }

  // 递归解析 callout 内部内容
  const innerMd = contentLines.join("\n")
  const { blocks: children } = parseObsidianMarkdown(`---\n---\n${innerMd}`)

  return {
    block: {
      id: randomUUID(),
      type: "callout",
      sortOrder,
      calloutType,
      title,
      foldable,
      defaultFolded,
      children
    },
    nextIndex: i
  }
}

/** 解析任务列表 */
function parseTaskBlock(
  lines: string[],
  start: number,
  sortOrder: number
): { block: TaskBlock; nextIndex: number } {
  const items: TaskItem[] = []
  let i = start

  while (i < lines.length) {
    const taskMatch = lines[i].match(/^(\s*)- \[(.)\]\s*(.*)/)
    if (!taskMatch) {
      break
    }

    const indent = Math.floor(taskMatch[1].length / 2)
    const rawStatus = taskMatch[2]
    const text = taskMatch[3].trim()

    let status: TaskItem["status"] = "unchecked"
    if (rawStatus === "x" || rawStatus === "X") {
      status = "checked"
    } else if (rawStatus === ">") {
      status = "deferred"
    } else if (rawStatus === "-") {
      status = "cancelled"
    }

    // 提取提醒日期
    const dateMatch = text.match(/\(@(\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2})?)\)/)
    const reminderDate = dateMatch?.[1]
    const cleanText = reminderDate ? text.replace(dateMatch[0], "").trim() : text

    items.push({
      status,
      rawStatus: `[${rawStatus}]`,
      text: cleanText,
      reminderDate,
      indent
    })
    i++
  }

  return {
    block: { id: randomUUID(), type: "task", sortOrder, items },
    nextIndex: i
  }
}

/** 解析表格 */
function parseTable(
  lines: string[],
  start: number,
  sortOrder: number
): { block: TableBlock; nextIndex: number } {
  const parseRow = (line: string) =>
    line.split("|").map((cell) => cell.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - (line.endsWith("|") ? 1 : 0))

  const headers = parseRow(lines[start])

  // 对齐行
  const alignRow = parseRow(lines[start + 1])
  const alignments: TableBlock["alignments"] = alignRow.map((cell) => {
    const left = cell.startsWith(":")
    const right = cell.endsWith(":")
    if (left && right) {
      return "center"
    }
    if (right) {
      return "right"
    }
    if (left) {
      return "left"
    }
    return "none"
  })

  const rows: string[][] = []
  let i = start + 2
  while (i < lines.length && lines[i].includes("|")) {
    rows.push(parseRow(lines[i]))
    i++
  }

  return {
    block: { id: randomUUID(), type: "table", sortOrder, headers, rows, alignments },
    nextIndex: i
  }
}
