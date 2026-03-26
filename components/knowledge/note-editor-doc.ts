/**
 * 笔记编辑器文档转换与块操作
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import type { JSONContent } from "@tiptap/core"
import type {
  InlineMark,
  NoteBlock,
  RichTextSegment
} from "@/src/server/store/types"

type BlockPlacement = "before" | "after"

const MARK_NAME_MAP: Record<string, InlineMark["type"]> = {
  bold: "bold",
  italic: "italic",
  strike: "strike",
  code: "code",
  link: "link"
}

/**
 * 块数组转换为 TipTap 文档
 */
export function blocksToTipTapDoc(blocks: NoteBlock[]): JSONContent {
  return {
    type: "doc",
    content: sortBlocks(blocks)
      .map((block) => blockToNode(block))
      .filter(isContentNode)
  }
}

/**
 * TipTap 文档转换回块数组
 */
export function tipTapDocToBlocks(doc: JSONContent): NoteBlock[] {
  return (doc.content ?? [])
    .map((node, index) => nodeToBlock(node, index))
    .filter(isBlock)
}

/**
 * 在指定块后插入新块
 */
export function insertBlockAfterInDoc(
  doc: JSONContent,
  afterBlockId: string,
  node: JSONContent
): JSONContent {
  const content = cloneContent(doc)
  const index = findBlockIndex(content, afterBlockId)
  const insertIndex = index >= 0 ? index + 1 : content.length
  content.splice(insertIndex, 0, node)
  return { ...doc, content }
}

/**
 * 顶层块拖拽排序
 */
export function moveBlockInDoc(
  doc: JSONContent,
  movingBlockId: string,
  targetBlockId: string,
  placement: BlockPlacement
): JSONContent {
  const content = cloneContent(doc)
  const movingIndex = findBlockIndex(content, movingBlockId)
  const targetIndex = findBlockIndex(content, targetBlockId)
  if (movingIndex < 0 || targetIndex < 0 || movingIndex === targetIndex) {
    return doc
  }

  const [movingNode] = content.splice(movingIndex, 1)
  const baseIndex = findBlockIndex(content, targetBlockId)
  const insertIndex = placement === "before" ? baseIndex : baseIndex + 1
  content.splice(insertIndex, 0, movingNode)
  return { ...doc, content }
}

/**
 * 复制一个块并替换新 ID
 */
export function duplicateBlockInDoc(
  doc: JSONContent,
  blockId: string,
  newBlockId: string
): JSONContent {
  const content = cloneContent(doc)
  const index = findBlockIndex(content, blockId)
  if (index < 0) {
    return doc
  }

  const duplicated = replaceNodeBlockId(content[index], newBlockId)
  content.splice(index + 1, 0, duplicated)
  return { ...doc, content }
}

/**
 * 删除一个顶层块
 */
export function deleteBlockInDoc(doc: JSONContent, blockId: string): JSONContent {
  const content = cloneContent(doc).filter((node) => getBlockId(node) !== blockId)
  return { ...doc, content }
}

/**
 * 替换一个顶层块
 */
export function replaceBlockInDoc(
  doc: JSONContent,
  blockId: string,
  node: JSONContent
): JSONContent {
  const content = cloneContent(doc)
  const index = findBlockIndex(content, blockId)
  if (index < 0) {
    return doc
  }
  content[index] = node
  return { ...doc, content }
}

function blockToNode(block: NoteBlock): JSONContent | null {
  switch (block.type) {
    case "heading":
      return createTextNode("heading", block.id, {
        level: block.level
      }, block.richText, block.text)
    case "paragraph":
      return createTextNode("paragraph", block.id, {}, block.richText, block.text)
    case "quote":
      return createTextNode("quoteBlock", block.id, {
        sourceBookTitle: block.sourceBookTitle ?? "",
        sourceLocation: block.sourceLocation ?? "",
        highlightId: block.highlightId ?? null
      }, block.richText, block.text)
    case "highlight":
      return createTextNode("highlightBlock", block.id, {
        label: block.label ?? "",
        sourceBookTitle: block.sourceBookTitle ?? "",
        sourceLocation: block.sourceLocation ?? "",
        highlightId: block.highlightId ?? null
      }, block.richText, block.text)
    case "insight":
      return createTextNode("insightBlock", block.id, {
        label: block.label ?? ""
      }, block.richText, block.text)
    case "code":
      return {
        type: "codeBlock",
        attrs: {
          blockId: block.id,
          language: block.language ?? ""
        },
        content: block.code ? [{ type: "text", text: block.code }] : []
      }
    case "divider":
      return {
        type: "horizontalRule",
        attrs: { blockId: block.id }
      }
    default:
      return {
        type: "importedBlock",
        attrs: {
          blockId: block.id,
          blockData: JSON.stringify(block)
        }
      }
  }
}

function createTextNode(
  type: string,
  blockId: string,
  attrs: Record<string, unknown>,
  richText: RichTextSegment[] | undefined,
  fallbackText: string | undefined
): JSONContent {
  return {
    type,
    attrs: {
      ...attrs,
      blockId
    },
    content: richTextToTipTap(richText, fallbackText)
  }
}

function richTextToTipTap(
  richText: RichTextSegment[] | undefined,
  fallbackText: string | undefined
): JSONContent[] {
  if (richText?.length) {
    return richText.map((segment) => ({
      type: "text",
      text: segment.text,
      marks: segment.marks?.map((mark) => ({
        type: mark.type,
        attrs: mark.attrs
      }))
    }))
  }
  if (!fallbackText) {
    return []
  }
  return [{ type: "text", text: fallbackText }]
}

function nodeToBlock(node: JSONContent, sortOrder: number): NoteBlock | null {
  switch (node.type) {
    case "heading":
      return {
        id: getBlockId(node),
        type: "heading",
        level: toHeadingLevel(node.attrs?.level),
        text: collectPlainText(node.content),
        richText: tipTapToRichText(node.content),
        sortOrder
      }
    case "paragraph":
      return {
        id: getBlockId(node),
        type: "paragraph",
        text: collectPlainText(node.content),
        richText: tipTapToRichText(node.content),
        sortOrder
      }
    case "quoteBlock":
      return {
        id: getBlockId(node),
        type: "quote",
        text: collectPlainText(node.content),
        richText: tipTapToRichText(node.content),
        sourceBookTitle: toStringAttr(node.attrs?.sourceBookTitle),
        sourceLocation: toStringAttr(node.attrs?.sourceLocation),
        highlightId: toNullableString(node.attrs?.highlightId),
        sortOrder
      }
    case "highlightBlock":
      return {
        id: getBlockId(node),
        type: "highlight",
        text: collectPlainText(node.content),
        richText: tipTapToRichText(node.content),
        label: toStringAttr(node.attrs?.label),
        sourceBookTitle: toStringAttr(node.attrs?.sourceBookTitle),
        sourceLocation: toStringAttr(node.attrs?.sourceLocation),
        highlightId: toNullableString(node.attrs?.highlightId),
        sortOrder
      }
    case "insightBlock":
      return {
        id: getBlockId(node),
        type: "insight",
        text: collectPlainText(node.content),
        richText: tipTapToRichText(node.content),
        label: toStringAttr(node.attrs?.label),
        sortOrder
      }
    case "codeBlock":
      return {
        id: getBlockId(node),
        type: "code",
        code: collectPlainText(node.content),
        language: toStringAttr(node.attrs?.language),
        sortOrder
      }
    case "horizontalRule":
      return {
        id: getBlockId(node),
        type: "divider",
        sortOrder
      }
    case "importedBlock":
      return parseImportedBlock(node, sortOrder)
    default:
      return null
  }
}

function tipTapToRichText(content: JSONContent[] | undefined): RichTextSegment[] | undefined {
  const segments = (content ?? [])
    .filter((node) => node.type === "text" && typeof node.text === "string")
    .map((node) => createRichTextSegment(node.text ?? "", normalizeMarks(node.marks)))
  return segments.length > 0 ? segments : undefined
}

function normalizeMarks(
  marks: JSONContent["marks"]
): RichTextSegment["marks"] | undefined {
  const normalized = (marks ?? [])
    .map((mark) => {
      const type = mark.type ? MARK_NAME_MAP[mark.type] : null
      if (!type) {
        return null
      }
      const attrs = mark.attrs?.href ? { href: String(mark.attrs.href) } : undefined
      return {
        type,
        ...(attrs ? { attrs } : {})
      }
    })
    .filter(isMark)
  return normalized.length > 0 ? normalized : undefined
}

function createRichTextSegment(
  text: string,
  marks: RichTextSegment["marks"] | undefined
): RichTextSegment {
  return marks ? { text, marks } : { text }
}

function parseImportedBlock(node: JSONContent, sortOrder: number): NoteBlock | null {
  const blockId = getBlockId(node)
  try {
    const parsed = JSON.parse(String(node.attrs?.blockData ?? "{}")) as NoteBlock
    return { ...parsed, id: blockId, sortOrder }
  } catch {
    return null
  }
}

function replaceNodeBlockId(node: JSONContent, blockId: string): JSONContent {
  const next = structuredClone(node)
  next.attrs = { ...(next.attrs ?? {}), blockId }
  if (next.type === "importedBlock") {
    next.attrs.blockData = rewriteImportedBlockId(next.attrs.blockData, blockId)
  }
  return next
}

function rewriteImportedBlockId(blockData: unknown, blockId: string): string {
  try {
    const parsed = JSON.parse(String(blockData ?? "{}")) as NoteBlock
    return JSON.stringify({ ...parsed, id: blockId })
  } catch {
    return JSON.stringify({ id: blockId })
  }
}

function cloneContent(doc: JSONContent): JSONContent[] {
  return structuredClone(doc.content ?? [])
}

function findBlockIndex(content: JSONContent[], blockId: string): number {
  return content.findIndex((node) => getBlockId(node) === blockId)
}

function getBlockId(node: JSONContent): string {
  return String(node.attrs?.blockId ?? crypto.randomUUID())
}

function collectPlainText(content: JSONContent[] | undefined): string {
  return (content ?? [])
    .map((node) => (node.type === "text" ? node.text ?? "" : ""))
    .join("")
}

function sortBlocks(blocks: NoteBlock[]): NoteBlock[] {
  return [...blocks].sort((left, right) => left.sortOrder - right.sortOrder)
}

function toHeadingLevel(value: unknown): 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3 ? value : 2
}

function toNullableString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined
}

function toStringAttr(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function isContentNode(node: JSONContent | null): node is JSONContent {
  return Boolean(node)
}

function isBlock(block: NoteBlock | null): block is NoteBlock {
  return Boolean(block)
}

function isMark(mark: InlineMark | null): mark is InlineMark {
  return Boolean(mark)
}
