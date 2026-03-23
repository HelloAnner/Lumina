/**
 * 阅读器字体设置面板
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import type React from "react"
import { Type } from "lucide-react"
import type { ReaderSettings } from "@/src/server/store/types"

export function ReaderFontPanel({
  open,
  fontPanelRef,
  fontSize,
  lineHeight,
  letterSpacing,
  onFontSizeChange,
  onLineHeightChange,
  onLetterSpacingChange,
  onToggle
}: {
  open: boolean
  fontPanelRef: React.RefObject<HTMLDivElement>
  fontSize: ReaderSettings["fontSize"]
  lineHeight: ReaderSettings["lineHeight"]
  letterSpacing: number
  onFontSizeChange: (value: ReaderSettings["fontSize"]) => void
  onLineHeightChange: (value: ReaderSettings["lineHeight"]) => void
  onLetterSpacingChange: (value: number) => void
  onToggle: () => void
}) {
  return (
    <div
      ref={fontPanelRef}
      className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2"
    >
      {open ? (
        <div className="mb-2 w-64 rounded-2xl border border-white/10 bg-elevated p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-secondary">
                <span>字号</span>
                <span className="tabular-nums">{fontSize}px</span>
              </div>
              <input
                type="range"
                min={12}
                max={22}
                step={1}
                value={fontSize}
                onChange={(e) =>
                  onFontSizeChange(Number(e.target.value) as ReaderSettings["fontSize"])
                }
                className="w-full accent-primary"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-secondary">
                <span>行距</span>
                <span className="tabular-nums">{lineHeight.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={1.4}
                max={3.0}
                step={0.1}
                value={lineHeight}
                onChange={(e) =>
                  onLineHeightChange(Number(e.target.value) as ReaderSettings["lineHeight"])
                }
                className="w-full accent-primary"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-secondary">
                <span>字间距</span>
                <span className="tabular-nums">{(letterSpacing * 100).toFixed(0)}%</span>
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
      ) : null}
      <button
        className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition ${
          open
            ? "border-primary/40 bg-primary/15 text-primary"
            : "border-white/10 bg-elevated text-secondary hover:bg-overlay hover:text-foreground"
        }`}
        onClick={onToggle}
        title="字体设置"
      >
        <Type className="h-5 w-5" />
      </button>
    </div>
  )
}
