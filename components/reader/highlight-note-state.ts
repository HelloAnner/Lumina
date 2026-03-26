/**
 * 划线想法编辑态工具
 * 负责把已有划线映射为想法弹窗的默认输入状态
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import type { Highlight } from "@/src/server/store/types"

/**
 * 从划线构建想法编辑态
 *
 * @param highlight
 */
export function buildHighlightNoteState(highlight: Highlight) {
  return {
    editingHighlightId: highlight.id,
    selectedText: highlight.content,
    noteDraft: highlight.note ?? ""
  }
}
