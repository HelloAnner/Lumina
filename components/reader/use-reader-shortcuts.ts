/**
 * 阅读器划词快捷键 Hook
 * 选中文本后通过键盘快捷键快速创建高亮或打开笔记
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useEffect } from "react"
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
  useEffect(() => {
    if (!selectedText) {
      return
    }

    const bindings = shortcuts ?? DEFAULT_SHORTCUTS

    function handleKeydown(event: KeyboardEvent) {
      // 忽略输入框内的按键
      const tag = (event.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return
      }

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
}

export { DEFAULT_SHORTCUTS }
