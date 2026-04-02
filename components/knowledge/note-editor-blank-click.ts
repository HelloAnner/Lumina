import { normalizeBlockOrder } from "@/components/knowledge/note-editor-doc"
import type { NoteBlock } from "@/src/server/store/types"

export const NOTE_EDITOR_EMPTY_LINE_HEIGHT_PX = 28

export type BlankAreaClickResult =
  | {
      type: "focus-existing"
      focusBlockId: string
    }
  | {
      type: "append-empty-paragraph"
      focusBlockId: string
      nextBlocks: NoteBlock[]
    }

export function resolveBlankAreaClick(
  blocks: NoteBlock[],
  options: {
    blankLineCount?: number
    createId?: () => string
  } = {}
): BlankAreaClickResult {
  const normalized = normalizeBlockOrder(blocks)
  const blankLineCount = Math.max(0, Math.floor(options.blankLineCount ?? 0))
  const createId = options.createId ?? (() => crypto.randomUUID())
  const trailingBlock = normalized.at(-1)

  if (blankLineCount === 0 && trailingBlock && isEmptyParagraphBlock(trailingBlock)) {
    return {
      type: "focus-existing",
      focusBlockId: trailingBlock.id
    }
  }

  const appendedBlocks = Array.from({ length: Math.max(1, blankLineCount) }, (_, index) =>
    createEmptyParagraphBlock(normalized.length + index, createId())
  )
  const nextBlock = appendedBlocks.at(-1)!
  return {
    type: "append-empty-paragraph",
    focusBlockId: nextBlock.id,
    nextBlocks: normalizeBlockOrder([...normalized, ...appendedBlocks])
  }
}

export function resolveBlankLineCountFromGap(
  gapPx: number,
  lineHeightPx: number = NOTE_EDITOR_EMPTY_LINE_HEIGHT_PX
) {
  if (gapPx <= 0) {
    return 0
  }
  return Math.floor(gapPx / lineHeightPx) + 1
}

export function createEmptyParagraphBlock(sortOrder: number, blockId: string): NoteBlock {
  return {
    id: blockId,
    type: "paragraph",
    text: "",
    sortOrder
  }
}

function isEmptyParagraphBlock(block: NoteBlock) {
  if (block.type !== "paragraph") {
    return false
  }
  if (block.text.trim().length > 0) {
    return false
  }
  const richText = block.richText ?? []
  return richText.every((segment) => segment.text.trim().length === 0)
}
