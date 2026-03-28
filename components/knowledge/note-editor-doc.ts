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
  ListItemContent,
  NoteBlock,
  RichTextSegment
} from "@/src/server/store/types"

type BlockPlacement = "before" | "after"

const MARK_NAME_MAP: Record<string, InlineMark["type"]> = {
  bold: "bold",
  italic: "italic",
  strike: "strike",
  code: "code",
  link: "link",
  highlight: "highlight"
}

/**
 * 块数组转换为 TipTap 文档
 */
export function blocksToTipTapDoc(blocks: NoteBlock[]): JSONContent {
  const content: JSONContent[] = []
  const sortedBlocks = sortBlocks(blocks)

  for (let index = 0; index < sortedBlocks.length; index += 1) {
    const block = sortedBlocks[index]
    const nextBlock = sortedBlocks[index + 1]
    if (
      (block.type === "quote" || block.type === "highlight") &&
      nextBlock?.type === "insight"
    ) {
      const combinedNode = blockToNode(block, nextBlock)
      if (isContentNode(combinedNode)) {
        content.push(combinedNode)
      }
      index += 1
      continue
    }

    const node = blockToNode(block)
    if (isContentNode(node)) {
      content.push(node)
    }
  }

  return {
    type: "doc",
    content
  }
}

/**
 * 归一化块顺序
 */
export function normalizeBlockOrder(blocks: NoteBlock[]): NoteBlock[] {
  return sortBlocks(blocks).map((block, index) => ({
    ...block,
    sortOrder: index
  }))
}

/**
 * TipTap 文档转换回块数组
 */
export function tipTapDocToBlocks(doc: JSONContent): NoteBlock[] {
  const blocks: NoteBlock[] = []
  let sortOrder = 0

  for (const node of doc.content ?? []) {
    const nodeBlocks = nodeToBlocks(node, sortOrder)
    blocks.push(...nodeBlocks)
    sortOrder += nodeBlocks.length
  }

  return blocks
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

  const duplicated = createDuplicatedBlockNode(content[index], newBlockId)
  content.splice(index + 1, 0, duplicated)
  return { ...doc, content }
}

/**
 * 克隆一个顶层块节点，并为其分配新的 blockId。
 * 组合引用块会额外生成新的 pairedInsightBlockId，避免复制后共用同一个 synthetic insight id。
 */
export function createDuplicatedBlockNode(
  node: JSONContent,
  newBlockId: string
): JSONContent {
  const duplicated = replaceNodeBlockId(node, newBlockId)
  if (typeof duplicated.attrs?.pairedInsightBlockId === "string" && duplicated.attrs.pairedInsightBlockId) {
    duplicated.attrs = {
      ...(duplicated.attrs ?? {}),
      pairedInsightBlockId: `${newBlockId}-insight`
    }
  }
  return duplicated
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

function blockToNode(
  block: NoteBlock,
  pairedInsight?: Extract<NoteBlock, { type: "insight" }>
): JSONContent | null {
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
        highlightId: block.highlightId ?? null,
        pairedInsightBlockId: pairedInsight?.id ?? null,
        pairedInsightText: pairedInsight?.text ?? "",
        pairedInsightLabel: pairedInsight?.label ?? "",
        pairedInsightRichText: serializeRichTextSegments(pairedInsight?.richText)
      }, block.richText, block.text)
    case "highlight":
      return createTextNode("highlightBlock", block.id, {
        label: block.label ?? "",
        sourceBookTitle: block.sourceBookTitle ?? "",
        sourceLocation: block.sourceLocation ?? "",
        highlightId: block.highlightId ?? null,
        pairedInsightBlockId: pairedInsight?.id ?? null,
        pairedInsightText: pairedInsight?.text ?? "",
        pairedInsightLabel: pairedInsight?.label ?? "",
        pairedInsightRichText: serializeRichTextSegments(pairedInsight?.richText)
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
    case "bullet-list":
      return {
        type: "bulletList",
        attrs: { blockId: block.id },
        content: listItemsToNodes(block.items, "listItem")
      }
    case "ordered-list":
      return {
        type: "orderedList",
        attrs: { blockId: block.id, start: block.start ?? 1 },
        content: listItemsToNodes(block.items, "listItem")
      }
    case "task-list":
      return {
        type: "taskList",
        attrs: { blockId: block.id },
        content: listItemsToNodes(block.items, "taskItem")
      }
    case "callout":
      return {
        type: "calloutBlock",
        attrs: {
          blockId: block.id,
          calloutType: block.calloutType ?? "info"
        },
        content: block.children?.length
          ? block.children.map((child) => blockToNode(child)).filter(isContentNode)
          : [{ type: "paragraph", content: [] }]
      }
    case "toggle":
      return {
        type: "toggleBlock",
        attrs: {
          blockId: block.id,
          title: block.title ?? "",
          collapsed: false
        },
        content: block.children?.length
          ? block.children.map((child) => blockToNode(child)).filter(isContentNode)
          : [{ type: "paragraph", content: [] }]
      }
    case "table":
      return tableBlockToNode(block)
    case "image":
      return {
        type: "imageBlock",
        attrs: {
          blockId: block.id,
          src: block.externalUrl ?? "",
          alt: block.alt ?? "",
          objectKey: block.objectKey ?? "",
          originalName: block.originalName ?? "",
          width: block.displayWidth ?? block.width ?? null,
          uploading: false
        }
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

function nodeToBlocks(node: JSONContent, sortOrder: number): NoteBlock[] {
  switch (node.type) {
    case "heading":
      return [{
        id: getBlockId(node),
        type: "heading",
        level: toHeadingLevel(node.attrs?.level),
        text: collectPlainText(node.content),
        richText: tipTapToRichText(node.content),
        sortOrder
      }]
    case "paragraph":
      return [{
        id: getBlockId(node),
        type: "paragraph",
        text: collectPlainText(node.content),
        richText: tipTapToRichText(node.content),
        sortOrder
      }]
    case "quoteBlock":
      return appendPairedInsight(node, [{
        id: getBlockId(node),
        type: "quote",
        text: collectPlainText(node.content),
        richText: tipTapToRichText(node.content),
        sourceBookTitle: toStringAttr(node.attrs?.sourceBookTitle),
        sourceLocation: toStringAttr(node.attrs?.sourceLocation),
        highlightId: toNullableString(node.attrs?.highlightId),
        sortOrder
      }], sortOrder)
    case "highlightBlock":
      return appendPairedInsight(node, [{
        id: getBlockId(node),
        type: "highlight",
        text: collectPlainText(node.content),
        richText: tipTapToRichText(node.content),
        label: toStringAttr(node.attrs?.label),
        sourceBookTitle: toStringAttr(node.attrs?.sourceBookTitle),
        sourceLocation: toStringAttr(node.attrs?.sourceLocation),
        highlightId: toNullableString(node.attrs?.highlightId),
        sortOrder
      }], sortOrder)
    case "insightBlock":
      return [{
        id: getBlockId(node),
        type: "insight",
        text: collectPlainText(node.content),
        richText: tipTapToRichText(node.content),
        label: toStringAttr(node.attrs?.label),
        sortOrder
      }]
    case "codeBlock":
      return [{
        id: getBlockId(node),
        type: "code",
        code: collectPlainText(node.content),
        language: toStringAttr(node.attrs?.language),
        sortOrder
      }]
    case "horizontalRule":
      return [{
        id: getBlockId(node),
        type: "divider",
        sortOrder
      }]
    case "bulletList":
      return [{
        id: getBlockId(node),
        type: "bullet-list",
        items: nodesToListItems(node.content, "listItem"),
        sortOrder
      }]
    case "orderedList":
      return [{
        id: getBlockId(node),
        type: "ordered-list",
        items: nodesToListItems(node.content, "listItem"),
        start: typeof node.attrs?.start === "number" ? node.attrs.start : undefined,
        sortOrder
      }]
    case "taskList":
      return [{
        id: getBlockId(node),
        type: "task-list",
        items: nodesToListItems(node.content, "taskItem"),
        sortOrder
      }]
    case "calloutBlock":
      return [{
        id: getBlockId(node),
        type: "callout",
        calloutType: String(node.attrs?.calloutType ?? "info"),
        title: "",
        foldable: false,
        defaultFolded: false,
        children: nestedNodesToBlocks(node.content),
        sortOrder
      }]
    case "toggleBlock":
      return [{
        id: getBlockId(node),
        type: "toggle",
        title: String(node.attrs?.title ?? ""),
        children: nestedNodesToBlocks(node.content),
        sortOrder
      }]
    case "table":
      return [tableNodeToBlock(node, sortOrder)]
    case "imageBlock":
      return [{
        id: getBlockId(node),
        type: "image",
        objectKey: String(node.attrs?.objectKey ?? ""),
        externalUrl: toNullableString(node.attrs?.src),
        originalName: String(node.attrs?.originalName ?? ""),
        alt: toNullableString(node.attrs?.alt),
        displayWidth: typeof node.attrs?.width === "number" ? node.attrs.width : undefined,
        sortOrder
      }]
    case "importedBlock":
      return wrapImportedBlock(parseImportedBlock(node, sortOrder))
    default:
      return []
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
  const normalized: InlineMark[] = []
  for (const mark of marks ?? []) {
    const type = mark.type ? MARK_NAME_MAP[mark.type] : null
    if (!type) {
      continue
    }
    const attrs = mark.attrs?.href ? { href: String(mark.attrs.href) } : undefined
    normalized.push(attrs ? { type, attrs } : { type })
  }
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

function wrapImportedBlock(block: NoteBlock | null) {
  return block ? [block] : []
}

function appendPairedInsight(
  node: JSONContent,
  blocks: NoteBlock[],
  sortOrder: number
) {
  const pairedInsightBlockId = toNullableString(node.attrs?.pairedInsightBlockId)
  const pairedInsightText = toStringAttr(node.attrs?.pairedInsightText)
  if (!pairedInsightBlockId || !pairedInsightText) {
    return blocks
  }

  blocks.push({
    id: pairedInsightBlockId,
    type: "insight",
    text: pairedInsightText,
    richText:
      parseRichTextSegments(node.attrs?.pairedInsightRichText)
      ?? [{ text: pairedInsightText }],
    label: toStringAttr(node.attrs?.pairedInsightLabel),
    sortOrder: sortOrder + 1
  })
  return blocks
}

function serializeRichTextSegments(richText: RichTextSegment[] | undefined) {
  if (!richText?.length) {
    return ""
  }
  return JSON.stringify(richText)
}

function parseRichTextSegments(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined
  }
  try {
    return JSON.parse(value) as RichTextSegment[]
  } catch {
    return undefined
  }
}

/**
 * TableBlock → TipTap table 节点
 */
function tableBlockToNode(block: Extract<NoteBlock, { type: "table" }>): JSONContent {
  const headerRow: JSONContent = {
    type: "tableRow",
    content: (block.headers ?? []).map((header) => ({
      type: "tableHeader",
      content: header ? [{ type: "paragraph", content: [{ type: "text", text: header }] }] : [{ type: "paragraph", content: [] }]
    }))
  }
  const bodyRows: JSONContent[] = (block.rows ?? []).map((row) => ({
    type: "tableRow",
    content: row.map((cell) => ({
      type: "tableCell",
      content: cell ? [{ type: "paragraph", content: [{ type: "text", text: cell }] }] : [{ type: "paragraph", content: [] }]
    }))
  }))
  return {
    type: "table",
    attrs: { blockId: block.id },
    content: [headerRow, ...bodyRows]
  }
}

/**
 * TipTap table 节点 → TableBlock
 */
function tableNodeToBlock(node: JSONContent, sortOrder: number): NoteBlock {
  const rows = node.content ?? []
  const headers: string[] = []
  const bodyRows: string[][] = []
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const cells = (row.content ?? []).map((cell) => {
      const paragraph = (cell.content ?? []).find((child) => child.type === "paragraph")
      return collectPlainText(paragraph?.content)
    })
    if (rowIndex === 0 && (row.content ?? []).some((cell) => cell.type === "tableHeader")) {
      headers.push(...cells)
    } else {
      bodyRows.push(cells)
    }
  }
  return {
    id: getBlockId(node),
    type: "table",
    headers,
    rows: bodyRows,
    alignments: headers.map(() => "left" as const),
    sortOrder
  }
}

/**
 * 嵌套节点转换为 NoteBlock[]（用于 callout/toggle 子内容）
 */
function nestedNodesToBlocks(content: JSONContent[] | undefined): NoteBlock[] {
  const blocks: NoteBlock[] = []
  let sortOrder = 0
  for (const child of content ?? []) {
    const childBlocks = nodeToBlocks(child, sortOrder)
    blocks.push(...childBlocks)
    sortOrder += childBlocks.length
  }
  return blocks
}

/**
 * ListItemContent[] → TipTap listItem/taskItem 节点
 */
function listItemsToNodes(items: ListItemContent[], itemType: "listItem" | "taskItem"): JSONContent[] {
  return items.map((item) => {
    const paragraph: JSONContent = {
      type: "paragraph",
      content: richTextToTipTap(item.richText, item.text)
    }
    const children: JSONContent[] = [paragraph]
    if (item.children?.length) {
      const nestedListType = itemType === "taskItem" ? "taskList" : "bulletList"
      children.push({
        type: nestedListType,
        content: listItemsToNodes(item.children, itemType)
      })
    }
    const attrs: Record<string, unknown> = {}
    if (itemType === "taskItem") {
      attrs.checked = item.checked ?? false
    }
    return {
      type: itemType,
      attrs,
      content: children
    }
  })
}

/**
 * TipTap listItem/taskItem 节点 → ListItemContent[]
 */
function nodesToListItems(content: JSONContent[] | undefined, itemType: "listItem" | "taskItem"): ListItemContent[] {
  return (content ?? []).map((itemNode) => {
    const paragraphNode = (itemNode.content ?? []).find((child) => child.type === "paragraph")
    const nestedList = (itemNode.content ?? []).find((child) =>
      child.type === "bulletList" || child.type === "orderedList" || child.type === "taskList"
    )
    const item: ListItemContent = {
      text: collectPlainText(paragraphNode?.content),
      richText: tipTapToRichText(paragraphNode?.content)
    }
    if (itemType === "taskItem") {
      item.checked = itemNode.attrs?.checked === true
    }
    if (nestedList?.content?.length) {
      item.children = nodesToListItems(nestedList.content, itemType)
    }
    return item
  })
}
