/**
 * 笔记编辑器状态辅助工具
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/27
 */
import type { NoteBlock } from "@/src/server/store/types"

export function buildNoteEditorStats(blocks: NoteBlock[]) {
  let charCount = 0
  for (const block of blocks) {
    if ("text" in block) {
      charCount += block.text.length
      continue
    }
    if ("code" in block) {
      charCount += block.code.length
    }
  }
  return {
    blockCount: blocks.length,
    charCount
  }
}

export function resolveSlashCommandState(
  blocks: NoteBlock[],
  currentBlockId: string | null | undefined
) {
  if (!currentBlockId) {
    return null
  }
  const block = blocks.find((item) => item.id === currentBlockId)
  if (!block || !("text" in block) || !block.text.startsWith("/")) {
    return null
  }
  return {
    blockId: block.id,
    query: block.text.slice(1)
  }
}
