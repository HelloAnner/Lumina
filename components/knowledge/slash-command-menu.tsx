/**
 * 斜杠命令菜单
 * 输入 / 后弹出的块类型选择浮层，支持过滤和键盘导航
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Code,
  Heading,
  Highlighter,
  Lightbulb,
  Minus,
  Pilcrow,
  Quote,
} from "lucide-react"
import { filterBlockTypes, type BlockTypeEntry } from "./block-type-registry"
import { cn } from "@/src/lib/utils"
import type { NoteBlockType } from "@/src/server/store/types"

const ICON_MAP: Record<string, React.ReactNode> = {
  heading: <Heading className="h-4 w-4" />,
  pilcrow: <Pilcrow className="h-4 w-4" />,
  quote: <Quote className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  minus: <Minus className="h-4 w-4" />,
  lightbulb: <Lightbulb className="h-4 w-4" />,
  highlighter: <Highlighter className="h-4 w-4" />,
}

interface SlashCommandMenuProps {
  /** `/` 后的过滤文本 */
  query: string
  /** 光标位置，用于定位浮层 */
  anchorRect: { top: number; left: number; bottom: number }
  onSelect: (type: NoteBlockType) => void
  onClose: () => void
}

export function SlashCommandMenu({
  query,
  anchorRect,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const filtered = useMemo(() => filterBlockTypes(query), [query])

  // 重置选中索引
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // 滚动到选中项
  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  // 键盘导航
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % filtered.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (filtered[activeIndex]) {
          onSelect(filtered[activeIndex].type)
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [filtered, activeIndex, onSelect, onClose])

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  // 计算位置：默认在光标下方，超出视窗则向上弹出
  const menuHeight = Math.min(filtered.length * 40 + 8, 328)
  const spaceBelow = window.innerHeight - anchorRect.bottom
  const showAbove = spaceBelow < menuHeight + 8
  const style: React.CSSProperties = {
    position: "fixed",
    left: anchorRect.left,
    top: showAbove ? anchorRect.top - menuHeight - 4 : anchorRect.bottom + 4,
    zIndex: 50,
    width: 240,
  }

  if (filtered.length === 0) {
    return (
      <div ref={menuRef} style={style} className="rounded-[10px] border border-border/60 bg-elevated p-3 shadow-lg shadow-black/20">
        <p className="text-center text-[12px] text-muted">无匹配结果</p>
      </div>
    )
  }

  return (
    <div
      ref={menuRef}
      style={style}
      className="rounded-[10px] border border-border/60 bg-elevated shadow-lg shadow-black/20 animate-in fade-in-0 zoom-in-95 duration-100"
    >
      <div className="max-h-[320px] overflow-y-auto p-1">
        {filtered.map((entry, i) => (
          <SlashMenuItem
            key={entry.type}
            entry={entry}
            active={i === activeIndex}
            ref={(el) => { itemRefs.current[i] = el }}
            onSelect={() => onSelect(entry.type)}
            onHover={() => setActiveIndex(i)}
          />
        ))}
      </div>
    </div>
  )
}

interface SlashMenuItemProps {
  entry: BlockTypeEntry
  active: boolean
  onSelect: () => void
  onHover: () => void
}

import { forwardRef } from "react"

const SlashMenuItem = forwardRef<HTMLButtonElement, SlashMenuItemProps>(
  function SlashMenuItem({ entry, active, onSelect, onHover }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left transition-colors",
          active ? "bg-primary/10 text-foreground" : "text-secondary hover:bg-overlay/50"
        )}
        onClick={onSelect}
        onMouseEnter={onHover}
      >
        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center", active ? "text-primary" : "text-muted")}>
          {ICON_MAP[entry.icon]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium leading-tight">{entry.label}</span>
          <span className="block text-[11px] leading-tight text-muted">{entry.description}</span>
        </span>
      </button>
    )
  }
)
