/**
 * 笔记编辑器命令菜单
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
"use client"

import { forwardRef, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronRight,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Info,
  Lightbulb,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table2
} from "lucide-react"
import {
  filterNoteEditorCommands,
  type NoteEditorCommand
} from "@/components/knowledge/note-editor-commands"
import { cn } from "@/src/lib/utils"

const ICON_MAP: Record<string, React.ReactNode> = {
  "heading-1": <Heading1 className="h-4 w-4" />,
  "heading-2": <Heading2 className="h-4 w-4" />,
  "heading-3": <Heading3 className="h-4 w-4" />,
  pilcrow: <Pilcrow className="h-4 w-4" />,
  quote: <Quote className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  minus: <Minus className="h-4 w-4" />,
  lightbulb: <Lightbulb className="h-4 w-4" />,
  highlighter: <Highlighter className="h-4 w-4" />,
  list: <List className="h-4 w-4" />,
  "list-ordered": <ListOrdered className="h-4 w-4" />,
  "list-checks": <ListChecks className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  "chevron-right": <ChevronRight className="h-4 w-4" />,
  table: <Table2 className="h-4 w-4" />
}

interface NoteEditorCommandMenuProps {
  query: string
  anchorRect: { top: number; left: number; bottom: number }
  onSelect: (commandKey: string) => void
  onClose: () => void
}

export function NoteEditorCommandMenu({
  query,
  anchorRect,
  onSelect,
  onClose
}: NoteEditorCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const filtered = useMemo(() => filterNoteEditorCommands(query), [query])
  const grouped = useMemo(() => groupCommands(filtered), [filtered])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (filtered.length === 0) {
        return
      }
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % filtered.length)
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length)
      }
      if (event.key === "Enter") {
        event.preventDefault()
        onSelect(filtered[activeIndex].key)
      }
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [activeIndex, filtered, onClose, onSelect])

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [onClose])

  const style = buildMenuStyle(anchorRect, filtered.length)
  if (filtered.length === 0) {
    return (
      <div ref={menuRef} style={style} className="note-command-menu p-3">
        <p className="text-center text-[12px] text-muted">无匹配结果</p>
      </div>
    )
  }

  let flatIndex = -1
  return (
    <div ref={menuRef} style={style} className="note-command-menu">
      <div className="max-h-[360px] overflow-y-auto p-1">
        {grouped.map((group) => (
          <div key={group.key} className="mb-1 last:mb-0">
            <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-muted">{group.label}</p>
            {group.commands.map((command) => {
              flatIndex += 1
              return (
                <CommandMenuItem
                  key={command.key}
                  ref={(element) => {
                    itemRefs.current[flatIndex] = element
                  }}
                  command={command}
                  active={flatIndex === activeIndex}
                  onHover={() => setActiveIndex(flatIndex)}
                  onSelect={() => onSelect(command.key)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

const CommandMenuItem = forwardRef<
  HTMLButtonElement,
  {
    command: NoteEditorCommand
    active: boolean
    onHover: () => void
    onSelect: () => void
  }
>(function CommandMenuItem({ command, active, onHover, onSelect }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left transition-colors",
        active ? "bg-primary/10 text-foreground" : "text-secondary hover:bg-overlay/60"
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center", active ? "text-primary" : "text-muted")}>
        {ICON_MAP[command.icon]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-tight">{command.label}</span>
        <span className="block text-[11px] leading-tight text-muted">{command.description}</span>
      </span>
    </button>
  )
})

function groupCommands(commands: NoteEditorCommand[]) {
  return [
    {
      key: "basic",
      label: "基础块",
      commands: commands.filter((command) => command.group === "basic")
    },
    {
      key: "turn-into",
      label: "转换为",
      commands: commands.filter((command) => command.group === "turn-into")
    }
  ].filter((group) => group.commands.length > 0)
}

function buildMenuStyle(anchorRect: { top: number; left: number; bottom: number }, count: number) {
  const menuHeight = Math.min(count * 40 + 56, 360)
  const spaceBelow = window.innerHeight - anchorRect.bottom
  const top = spaceBelow < menuHeight + 12
    ? anchorRect.top - menuHeight - 8
    : anchorRect.bottom + 8
  return {
    position: "fixed" as const,
    left: Math.min(anchorRect.left, window.innerWidth - 296),
    top: Math.max(12, top),
    width: 280,
    zIndex: 60
  }
}
