import type { NoteBlock } from "@/src/server/store/types"

export function resolveJumpTargetBlockId(
  blocks: NoteBlock[],
  target: {
    blockId?: string
    highlightId?: string
  }
) {
  if (target.blockId && hasBlockId(blocks, target.blockId)) {
    return target.blockId
  }

  if (!target.highlightId) {
    return undefined
  }

  return findBlockIdByHighlightId(blocks, target.highlightId)
}

function hasBlockId(blocks: NoteBlock[], blockId: string): boolean {
  return walkBlocks(blocks).some((block) => block.id === blockId)
}

function findBlockIdByHighlightId(blocks: NoteBlock[], highlightId: string) {
  return walkBlocks(blocks).find((block) => {
    return "highlightId" in block && block.highlightId === highlightId
  })?.id
}

function walkBlocks(blocks: NoteBlock[]): NoteBlock[] {
  return blocks.flatMap((block) => {
    const nested =
      "children" in block && Array.isArray(block.children)
        ? walkBlocks(block.children)
        : []
    return [block, ...nested]
  })
}
