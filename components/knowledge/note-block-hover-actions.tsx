/**
 * 笔记块悬浮操作
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import React from "react"
import { GripVertical, Plus, Trash2 } from "lucide-react"

export function NoteBlockHoverActions({
  top,
  onOpenInsert,
  onOpenMenu,
  onDelete,
  onDragStart
}: {
  top: number
  onOpenInsert: () => void
  onOpenMenu: (x: number, y: number) => void
  onDelete: () => void
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void
}) {
  return (
    <div className="note-block-gutter" style={{ top }}>
      <button
        className="gutter-button"
        title="插入块"
        onMouseDown={preventFocusLoss}
        onClick={onOpenInsert}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        draggable
        className="gutter-button"
        title="拖动排序"
        onMouseDown={preventFocusLoss}
        onClick={(event) => onOpenMenu(event.clientX, event.clientY)}
        onDragStart={onDragStart}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        className="gutter-button"
        title="删除块"
        onMouseDown={preventFocusLoss}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function preventFocusLoss(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault()
}
