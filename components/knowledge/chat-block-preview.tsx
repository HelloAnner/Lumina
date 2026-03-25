/**
 * AI 对话块预览卡片
 * 展示 AI 建议的修改/新建块，用户手动确认后应用
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useState } from "react"
import { Check, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/src/lib/utils"
import type { NoteChatAction, NoteBlock } from "@/src/server/store/types"

interface ChatBlockPreviewProps {
  action: NoteChatAction
  onApplyModify: (targetBlockId: string, block: NoteBlock) => void
  onApplyInsert: (blocks: NoteBlock[]) => void
}

/** 简要展示块内容 */
function getBlockPreviewText(block: NoteBlock): string {
  if ("text" in block && typeof block.text === "string") {
    return block.text
  }
  if ("code" in block && typeof block.code === "string") {
    return block.code
  }
  if ("title" in block && typeof block.title === "string") {
    return block.title
  }
  return `[${block.type}]`
}

/**
 * 块预览卡片
 */
export function ChatBlockPreview({
  action,
  onApplyModify,
  onApplyInsert
}: ChatBlockPreviewProps) {
  const [applied, setApplied] = useState(false)

  const handleApply = () => {
    if (action.type === "modify") {
      onApplyModify(action.targetBlockId, action.block)
    } else {
      onApplyInsert(action.blocks)
    }
    setApplied(true)
  }

  const isModify = action.type === "modify"
  const previewBlocks = isModify ? [action.block] : action.blocks

  return (
    <div className="rounded-lg border border-border/30 bg-surface p-2.5">
      {/* 标签 */}
      <div className="mb-2 flex items-center gap-1.5">
        {isModify ? (
          <RotateCcw className="h-3 w-3 text-primary/60" />
        ) : (
          <Plus className="h-3 w-3 text-primary/60" />
        )}
        <span className="text-[10px] font-medium uppercase tracking-wider text-secondary">
          {isModify ? "修改建议" : "新建块"}
        </span>
      </div>

      {/* 预览内容 */}
      <div className="space-y-1.5">
        {previewBlocks.map((block) => (
          <div
            key={block.id}
            className="rounded-md bg-elevated/40 px-2.5 py-1.5"
          >
            <span className="mr-1.5 text-[10px] text-muted">{block.type}</span>
            <span className="text-[11px] leading-relaxed text-foreground/70 line-clamp-3">
              {getBlockPreviewText(block)}
            </span>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      {!applied ? (
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            className="h-6 gap-1 px-2.5 text-[11px]"
            onClick={handleApply}
          >
            <Check className="h-3 w-3" />
            {isModify ? "应用" : "插入"}
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5">
          <Check className="h-3 w-3 text-success" />
          <span className="text-[10px] text-success">
            {isModify ? "已应用" : "已插入"}
          </span>
        </div>
      )}
    </div>
  )
}
