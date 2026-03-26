/**
 * 快捷键工具测试
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_APP_KEYBOARD_SHORTCUTS,
  formatShortcutForDisplay,
  getShortcutFieldLabel,
  normalizeShortcut,
  validateKeyboardShortcuts
} from "@/src/lib/keyboard-shortcuts"

test("normalizeShortcut 会规范化组合键顺序与大小写", () => {
  assert.equal(normalizeShortcut("shift+cmd+h"), "Cmd+Shift+H")
  assert.equal(normalizeShortcut(" alt + 1 "), "Alt+1")
  assert.equal(normalizeShortcut("ctrl+arrowup"), "Ctrl+ArrowUp")
})

test("validateKeyboardShortcuts 会识别重复绑定", () => {
  const issues = validateKeyboardShortcuts({
    ...DEFAULT_APP_KEYBOARD_SHORTCUTS,
    noteEditor: {
      ...DEFAULT_APP_KEYBOARD_SHORTCUTS.noteEditor,
      italic: "Cmd+B"
    }
  })

  assert.equal(issues.some((item) => item.code === "duplicate"), true)
})

test("validateKeyboardShortcuts 会识别系统保留快捷键", () => {
  const issues = validateKeyboardShortcuts({
    ...DEFAULT_APP_KEYBOARD_SHORTCUTS,
    noteEditor: {
      ...DEFAULT_APP_KEYBOARD_SHORTCUTS.noteEditor,
      link: "Cmd+W"
    }
  })

  assert.equal(issues.some((item) => item.code === "reserved"), true)
})

test("formatShortcutForDisplay 会按平台格式化显示", () => {
  assert.equal(formatShortcutForDisplay("Cmd+Shift+H", "mac"), "⌘⇧H")
  assert.equal(formatShortcutForDisplay("Ctrl+Shift+H", "windows"), "Ctrl+Shift+H")
})

test("getShortcutFieldLabel 会返回可读名称", () => {
  assert.equal(getShortcutFieldLabel("noteEditor.bold"), "笔记 · 加粗")
})
