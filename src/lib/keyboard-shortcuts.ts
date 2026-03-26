import type {
  AppKeyboardShortcuts,
  HighlightShortcuts,
  NoteEditorShortcuts
} from "@/src/server/store/types"

export const DEFAULT_READER_SHORTCUTS: HighlightShortcuts = {
  yellow: "1",
  green: "2",
  blue: "3",
  pink: "4",
  note: "N"
}

export const DEFAULT_NOTE_EDITOR_SHORTCUTS: NoteEditorShortcuts = {
  annotate: "C",
  bold: "Cmd+B",
  italic: "Cmd+I",
  highlight: "Cmd+Shift+H",
  strike: "Cmd+Shift+S",
  code: "Cmd+Shift+E",
  link: "Cmd+K",
  duplicateBlock: "Cmd+D",
  moveBlockUp: "Cmd+Shift+ArrowUp",
  moveBlockDown: "Cmd+Shift+ArrowDown",
  heading1: "Alt+1",
  heading2: "Alt+2",
  heading3: "Alt+3",
  paragraph: "Alt+0"
}

export const DEFAULT_APP_KEYBOARD_SHORTCUTS: AppKeyboardShortcuts = {
  reader: DEFAULT_READER_SHORTCUTS,
  noteEditor: DEFAULT_NOTE_EDITOR_SHORTCUTS
}

const RESERVED_SHORTCUTS = new Set([
  "Cmd+Q",
  "Cmd+W",
  "Cmd+T",
  "Cmd+N",
  "Cmd+L",
  "Cmd+R",
  "Cmd+Shift+R",
  "Cmd+Tab",
  "Cmd+Space",
  "Cmd+Shift+3",
  "Cmd+Shift+4",
  "Cmd+Shift+5",
  "Cmd+[",
  "Cmd+]",
  "Ctrl+W",
  "Ctrl+T",
  "Ctrl+N",
  "Ctrl+L",
  "Ctrl+R",
  "Ctrl+Shift+R",
  "Ctrl+Tab",
  "Ctrl+Shift+Tab",
  "Ctrl+Space",
  "Alt+Tab",
  "Alt+Left",
  "Alt+Right"
])

const MODIFIER_ALIASES: Record<string, string> = {
  cmd: "Cmd",
  command: "Cmd",
  meta: "Cmd",
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "Alt",
  option: "Alt",
  shift: "Shift"
}

const SPECIAL_KEY_ALIASES: Record<string, string> = {
  " ": "Space",
  space: "Space",
  esc: "Escape",
  escape: "Escape",
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  delete: "Delete",
  backspace: "Backspace",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight"
}

const MODIFIER_ORDER = ["Cmd", "Ctrl", "Alt", "Shift"]

export interface ShortcutValidationIssue {
  code: "duplicate" | "reserved" | "empty"
  shortcut: string
  fields: string[]
}

export type ShortcutPlatform = "mac" | "windows"

const FIELD_LABELS: Record<string, string> = {
  "reader.yellow": "阅读 · 黄色高亮",
  "reader.green": "阅读 · 绿色高亮",
  "reader.blue": "阅读 · 蓝色高亮",
  "reader.pink": "阅读 · 粉色高亮",
  "reader.note": "阅读 · 笔记",
  "noteEditor.annotate": "笔记 · 批注",
  "noteEditor.bold": "笔记 · 加粗",
  "noteEditor.italic": "笔记 · 斜体",
  "noteEditor.highlight": "笔记 · 高亮",
  "noteEditor.strike": "笔记 · 删除线",
  "noteEditor.code": "笔记 · 行内代码",
  "noteEditor.link": "笔记 · 链接",
  "noteEditor.duplicateBlock": "笔记 · 复制块",
  "noteEditor.moveBlockUp": "笔记 · 块上移",
  "noteEditor.moveBlockDown": "笔记 · 块下移",
  "noteEditor.heading1": "笔记 · 标题 1",
  "noteEditor.heading2": "笔记 · 标题 2",
  "noteEditor.heading3": "笔记 · 标题 3",
  "noteEditor.paragraph": "笔记 · 正文"
}

export function getEffectiveKeyboardShortcuts(
  shortcuts?: AppKeyboardShortcuts,
  legacyReaderShortcuts?: HighlightShortcuts
): AppKeyboardShortcuts {
  return {
    reader: {
      ...DEFAULT_READER_SHORTCUTS,
      ...(legacyReaderShortcuts ?? {}),
      ...(shortcuts?.reader ?? {})
    },
    noteEditor: {
      ...DEFAULT_NOTE_EDITOR_SHORTCUTS,
      ...(shortcuts?.noteEditor ?? {})
    }
  }
}

export function normalizeShortcut(input: string): string {
  const raw = input.trim()
  if (!raw) {
    return ""
  }
  const parts = raw
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
  const modifiers = new Set<string>()
  let key = ""
  for (const part of parts) {
    const normalizedModifier = MODIFIER_ALIASES[part.toLowerCase()]
    if (normalizedModifier) {
      modifiers.add(normalizedModifier)
      continue
    }
    key = normalizeKeyToken(part)
  }
  if (!key) {
    return Array.from(modifiers)
      .sort((left, right) => MODIFIER_ORDER.indexOf(left) - MODIFIER_ORDER.indexOf(right))
      .join("+")
  }
  const orderedModifiers = Array.from(modifiers)
    .sort((left, right) => MODIFIER_ORDER.indexOf(left) - MODIFIER_ORDER.indexOf(right))
  return [...orderedModifiers, key].join("+")
}

export function serializeShortcutEvent(event: KeyboardEvent): string {
  const key = normalizeEventKey(event.key)
  if (!key) {
    return ""
  }
  const parts: string[] = []
  if (event.metaKey) {
    parts.push("Cmd")
  }
  if (event.ctrlKey) {
    parts.push("Ctrl")
  }
  if (event.altKey) {
    parts.push("Alt")
  }
  if (event.shiftKey) {
    parts.push("Shift")
  }
  parts.push(key)
  return normalizeShortcut(parts.join("+"))
}

export function matchesShortcut(event: KeyboardEvent, binding: string): boolean {
  const normalizedBinding = normalizeShortcut(binding)
  if (!normalizedBinding) {
    return false
  }
  return serializeShortcutEvent(event) === normalizedBinding
}

export function validateKeyboardShortcuts(
  shortcuts: AppKeyboardShortcuts
): ShortcutValidationIssue[] {
  const flattened = flattenShortcutEntries(shortcuts)
  const issues: ShortcutValidationIssue[] = []
  const used = new Map<string, string[]>()
  for (const entry of flattened) {
    const normalized = normalizeShortcut(entry.shortcut)
    if (!normalized) {
      issues.push({
        code: "empty",
        shortcut: "",
        fields: [entry.field]
      })
      continue
    }
    if (RESERVED_SHORTCUTS.has(normalized)) {
      issues.push({
        code: "reserved",
        shortcut: normalized,
        fields: [entry.field]
      })
    }
    const existing = used.get(normalized) ?? []
    existing.push(entry.field)
    used.set(normalized, existing)
  }
  for (const [shortcut, fields] of used.entries()) {
    if (fields.length > 1) {
      issues.push({
        code: "duplicate",
        shortcut,
        fields
      })
    }
  }
  return issues
}

export function findShortcutIssueForField(
  issues: ShortcutValidationIssue[],
  field: string
) {
  return issues.find((issue) => issue.fields.includes(field))
}

export function detectShortcutPlatform(): ShortcutPlatform {
  if (typeof navigator === "undefined") {
    return "mac"
  }
  return /mac|iphone|ipad/i.test(navigator.platform) ? "mac" : "windows"
}

export function isModifierOnlyKey(key: string): boolean {
  return key === "Cmd" || key === "Ctrl" || key === "Alt" || key === "Shift"
}

export function getShortcutFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

export function formatShortcutForDisplay(
  shortcut: string,
  platform: ShortcutPlatform
): string {
  const normalized = normalizeShortcut(shortcut)
  if (!normalized) {
    return ""
  }
  if (platform !== "mac") {
    return normalized
  }
  return normalized
    .split("+")
    .map((part) => {
      if (part === "Cmd") {
        return "⌘"
      }
      if (part === "Shift") {
        return "⇧"
      }
      if (part === "Alt") {
        return "⌥"
      }
      if (part === "Ctrl") {
        return "⌃"
      }
      if (part === "ArrowUp") {
        return "↑"
      }
      if (part === "ArrowDown") {
        return "↓"
      }
      if (part === "ArrowLeft") {
        return "←"
      }
      if (part === "ArrowRight") {
        return "→"
      }
      return part
    })
    .join("")
}

function flattenShortcutEntries(shortcuts: AppKeyboardShortcuts) {
  return [
    ...Object.entries(shortcuts.reader).map(([key, shortcut]) => ({
      field: `reader.${key}`,
      shortcut
    })),
    ...Object.entries(shortcuts.noteEditor).map(([key, shortcut]) => ({
      field: `noteEditor.${key}`,
      shortcut
    }))
  ]
}

function normalizeEventKey(key: string): string {
  const normalized = normalizeKeyToken(key)
  return isModifierOnlyKey(normalized) ? "" : normalized
}

function normalizeKeyToken(token: string): string {
  const raw = token.trim()
  if (!raw) {
    return ""
  }
  const alias = SPECIAL_KEY_ALIASES[raw.toLowerCase()]
  if (alias) {
    return alias
  }
  if (raw.length === 1) {
    return raw.toUpperCase()
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
