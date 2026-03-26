/**
 * 图片操作条
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
"use client"

import { ImagePlus, Sparkles } from "lucide-react"

export function ImageActionBar({
  onCollect,
  onTransfer
}: {
  onCollect: () => void
  onTransfer: () => void
}) {
  return (
    <div className="mt-2 flex items-center justify-center gap-2">
      <button
        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface/80 px-3 py-1 text-[11px] text-secondary transition hover:text-foreground"
        onClick={onCollect}
      >
        <ImagePlus className="h-3.5 w-3.5" />
        收藏图片
      </button>
      <button
        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface/80 px-3 py-1 text-[11px] text-secondary transition hover:text-foreground"
        onClick={onTransfer}
      >
        <Sparkles className="h-3.5 w-3.5" />
        转入知识库
      </button>
    </div>
  )
}
