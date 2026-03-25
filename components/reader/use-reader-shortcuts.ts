/**
 * 阅读器划词快捷键 Hook
 * 选中文本后通过键盘快捷键快速创建高亮或打开笔记
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import type { HighlightColor, HighlightShortcuts } from "@/src/server/store/types"

const DEFAULT_SHORTCUTS: HighlightShortcuts = {
  yellow: "1",
  green: "2",
  blue: "3",
  pink: "4",
  note: "n"
}

export function useReaderShortcuts({
  selectedText,
  shortcuts,
  onHighlight,
  onNote
}: {
  selectedText: string
  shortcuts?: HighlightShortcuts
  onHighlight: (color: HighlightColor) => void
  onNote: () => void
}) {
  const [showHint, setShowHint] = useState(false)

  const dismissHint = useCallback(() => setShowHint(false), [])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return
      }

      // ? 键切换快捷键提示
      if (event.key === "?") {
        event.preventDefault()
        setShowHint((prev) => !prev)
        return
      }

      // 高亮快捷键仅在有选中文本时生效
      if (!selectedText) {
        return
      }

      const bindings = shortcuts ?? DEFAULT_SHORTCUTS
      const key = event.key.toLowerCase()
      const colors: HighlightColor[] = ["yellow", "green", "blue", "pink"]

      for (const color of colors) {
        if (key === bindings[color].toLowerCase()) {
          event.preventDefault()
          onHighlight(color)
          return
        }
      }

      if (key === bindings.note.toLowerCase()) {
        event.preventDefault()
        onNote()
      }
    }

    window.addEventListener("keydown", handleKeydown)
    return () => window.removeEventListener("keydown", handleKeydown)
  }, [selectedText, shortcuts, onHighlight, onNote])

  return { showShortcutHint: showHint, dismissShortcutHint: dismissHint }
}

export { DEFAULT_SHORTCUTS }
