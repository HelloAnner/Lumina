"use client"

import { useCallback, useEffect, useRef } from "react"
import { cn } from "@/src/lib/utils"

/**
 * 右键上下文菜单
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  /** 右侧快捷键提示 */
  shortcut?: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

export interface ContextMenuDivider {
  type: "divider"
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider

interface ContextMenuProps {
  items: ContextMenuEntry[]
  position: { x: number; y: number }
  onClose: () => void
}

function isDivider(entry: ContextMenuEntry): entry is ContextMenuDivider {
  return "type" in entry && entry.type === "divider"
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("contextmenu", handleClickOutside)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("contextmenu", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [handleClickOutside, onClose])

  // 确保菜单不超出视窗
  const style: React.CSSProperties = {
    position: "fixed",
    left: position.x,
    top: position.y,
    zIndex: 50
  }

  return (
    <div
      ref={ref}
      className="min-w-[180px] rounded-[10px] border border-border/60 bg-elevated p-1 shadow-lg shadow-black/20 animate-in fade-in-0 zoom-in-95 duration-100"
      style={style}
    >
      {items.map((entry, i) => {
        if (isDivider(entry)) {
          return (
            <div key={`d-${i}`} className="mx-2 my-1 h-px bg-border/40" />
          )
        }
        return (
          <button
            key={entry.label}
            disabled={entry.disabled}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors",
              entry.destructive
                ? "text-error hover:bg-error/10"
                : "text-foreground hover:bg-overlay/60",
              entry.disabled && "pointer-events-none opacity-40"
            )}
            onClick={() => {
              entry.onClick()
              onClose()
            }}
          >
            {entry.icon && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted">
                {entry.icon}
              </span>
            )}
            <span className="flex-1 text-left">{entry.label}</span>
            {entry.shortcut && (
              <span className="shrink-0 text-[11px] text-muted">
                {entry.shortcut}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
