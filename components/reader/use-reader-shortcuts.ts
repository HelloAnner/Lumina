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
import {
  DEFAULT_READER_SHORTCUTS,
  getEffectiveKeyboardShortcuts,
  matchesShortcut
} from "@/src/lib/keyboard-shortcuts"
import type {
  AppKeyboardShortcuts,
  HighlightColor,
  HighlightShortcuts
} from "@/src/server/store/types"

export function useReaderShortcuts({
  selectedText,
  shortcuts,
  keyboardShortcuts,
  onHighlight,
  onNote
}: {
  selectedText: string
  shortcuts?: HighlightShortcuts
  keyboardShortcuts?: AppKeyboardShortcuts
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

      const bindings = getEffectiveKeyboardShortcuts(
        keyboardShortcuts,
        shortcuts
      ).reader
      const colors: HighlightColor[] = ["yellow", "green", "blue", "pink"]

      for (const color of colors) {
        if (matchesShortcut(event, bindings[color])) {
          event.preventDefault()
          onHighlight(color)
          return
        }
      }

      if (matchesShortcut(event, bindings.note)) {
        event.preventDefault()
        onNote()
      }
    }

    window.addEventListener("keydown", handleKeydown)
    return () => window.removeEventListener("keydown", handleKeydown)
  }, [keyboardShortcuts, onHighlight, onNote, selectedText, shortcuts])

  return { showShortcutHint: showHint, dismissShortcutHint: dismissHint }
}

export { DEFAULT_READER_SHORTCUTS as DEFAULT_SHORTCUTS }
