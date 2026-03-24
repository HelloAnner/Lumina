/**
 * 阅读器字体设置下拉面板（从顶栏 T 按钮展开）
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 * Updated on 2026/3/24 - 从底部浮动改为顶栏下拉式，对齐 pen 设计
 */
"use client"

import type React from "react"
import { cn } from "@/src/lib/utils"
import type { ReaderSettings, TranslationDisplayMode } from "@/src/server/store/types"

export function ReaderFontPanel({
  open,
  fontPanelRef,
  fontSize,
  lineHeight,
  letterSpacing,
  translationView,
  isCurrentSectionTranslating,
  onFontSizeChange,
  onLineHeightChange,
  onLetterSpacingChange,
  onToggleTranslation
}: {
  open: boolean
  fontPanelRef: React.RefObject<HTMLDivElement>
  fontSize: ReaderSettings["fontSize"]
  lineHeight: ReaderSettings["lineHeight"]
  letterSpacing: number
  translationView?: TranslationDisplayMode
  isCurrentSectionTranslating?: boolean
  onFontSizeChange: (value: ReaderSettings["fontSize"]) => void
  onLineHeightChange: (value: ReaderSettings["lineHeight"]) => void
  onLetterSpacingChange: (value: number) => void
  onToggleTranslation?: () => void
}) {
  if (!open) return null

  return (
    <div
      ref={fontPanelRef}
      className="absolute right-4 top-2 z-30 w-[260px] rounded-xl border border-border/60 bg-elevated shadow-xl"
    >
      <div className="flex flex-col gap-5 p-5">

        {/* 阅读视图切换 */}
        {translationView !== undefined && (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-secondary">阅读视图</span>
                <span className="text-[11px] text-muted">
                  {isCurrentSectionTranslating ? "翻译中…" : translationView === "translation" ? "译文" : "原文"}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => translationView === "translation" && onToggleTranslation?.()}
                  className={cn(
                    "flex h-8 flex-1 items-center justify-center rounded-lg text-xs font-medium transition-all",
                    translationView !== "translation"
                      ? "bg-primary text-white"
                      : "bg-elevated text-secondary hover:text-foreground"
                  )}
                >
                  原文
                </button>
                <button
                  onClick={() => translationView !== "translation" && onToggleTranslation?.()}
                  className={cn(
                    "flex h-8 flex-1 items-center justify-center rounded-lg text-xs font-medium transition-all",
                    translationView === "translation"
                      ? "bg-primary text-white"
                      : "bg-elevated text-secondary hover:text-foreground"
                  )}
                >
                  译文
                </button>
              </div>
            </div>
            <div className="h-px bg-border/40" />
          </>
        )}

        {/* 字号 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-secondary">字号</span>
            <span className="text-[11px] tabular-nums text-muted">{fontSize}px</span>
          </div>
          <input
            type="range"
            min={12}
            max={22}
            step={1}
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value) as ReaderSettings["fontSize"])}
            className="w-full accent-primary"
          />
        </div>

        <div className="h-px bg-border/40" />

        {/* 行距 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-secondary">行距</span>
            <span className="text-[11px] tabular-nums text-muted">{lineHeight.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={1.4}
            max={3.0}
            step={0.1}
            value={lineHeight}
            onChange={(e) => onLineHeightChange(Number(e.target.value) as ReaderSettings["lineHeight"])}
            className="w-full accent-primary"
          />
        </div>

        <div className="h-px bg-border/40" />

        {/* 字间距 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-secondary">字间距</span>
            <span className="text-[11px] tabular-nums text-muted">{(letterSpacing * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.1}
            step={0.005}
            value={letterSpacing}
            onChange={(e) => onLetterSpacingChange(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

      </div>
    </div>
  )
}
