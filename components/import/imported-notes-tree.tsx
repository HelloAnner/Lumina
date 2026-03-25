/**
 * 导入笔记树形导航
 * 在知识库页面的主题树面板中展示导入来源和笔记列表
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Import
} from "lucide-react"
import { cn } from "@/src/lib/utils"

interface ImportSourceSummary {
  id: string
  name: string
  noteCount: number
}

interface ImportNoteSummary {
  id: string
  sourceId: string
  relativePath: string
  title: string
  tags: string[]
}

interface Props {
  selectedNoteId?: string | null
  onSelectNote: (noteId: string) => void
}

export function ImportedNotesTree({ selectedNoteId, onSelectNote }: Props) {
  const [sources, setSources] = useState<ImportSourceSummary[]>([])
  const [notes, setNotes] = useState<ImportNoteSummary[]>([])
  const [expanded, setExpanded] = useState(true)
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void (async () => {
      try {
        const [srcRes, notesRes] = await Promise.all([
          fetch("/api/import/sources"),
          fetch("/api/import/notes")
        ])
        if (srcRes.ok) {
          const data = await srcRes.json()
          const items = (data.items ?? []) as Array<ImportSourceSummary & { stats?: { noteCount: number } }>
          setSources(items.map((s) => ({
            id: s.id,
            name: s.name,
            noteCount: s.stats?.noteCount ?? 0
          })))
          // 默认展开所有来源
          setExpandedSources(Object.fromEntries(items.map((s) => [s.id, true])))
        }
        if (notesRes.ok) {
          const data = await notesRes.json()
          setNotes(data.items ?? [])
        }
      } catch {
        // 忽略
      }
    })()
  }, [])

  const totalNotes = notes.length
  if (sources.length === 0) return null

  return (
    <div className="mt-2">
      <div className="border-t border-border/30 my-1.5" />

      {/* 导入笔记分组头 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 rounded-sm px-2 py-[3px] text-left text-[13px] text-muted hover:bg-overlay/40 hover:text-secondary transition-colors"
      >
        {expanded
          ? <ChevronDown className="h-3 w-3 shrink-0" />
          : <ChevronRight className="h-3 w-3 shrink-0" />
        }
        <Import className="h-3.5 w-3.5 shrink-0 text-muted/60" />
        <span className="flex-1 truncate">导入笔记</span>
        <span className="rounded-full bg-elevated px-1.5 py-0.5 text-[10px] text-muted">
          {totalNotes}
        </span>
      </button>

      {expanded && sources.map((source) => {
        const sourceNotes = notes.filter((n) => n.sourceId === source.id)
        const isExpanded = expandedSources[source.id] ?? false

        return (
          <div key={source.id} className="ml-2">
            <button
              onClick={() => setExpandedSources((prev) => ({
                ...prev,
                [source.id]: !prev[source.id]
              }))}
              className="flex w-full items-center gap-1.5 rounded-sm px-2 py-[3px] text-left text-[12px] text-muted hover:bg-overlay/40 hover:text-secondary transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="h-2.5 w-2.5 shrink-0" />
                : <ChevronRight className="h-2.5 w-2.5 shrink-0" />
              }
              <FolderOpen className="h-3 w-3 shrink-0 text-accent-purple/60" />
              <span className="flex-1 truncate">{source.name}</span>
            </button>

            {isExpanded && sourceNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-sm py-[2px] pl-7 pr-2 text-left text-[12px] transition-colors",
                  selectedNoteId === note.id
                    ? "bg-primary/10 text-foreground"
                    : "text-muted hover:bg-overlay/40 hover:text-secondary"
                )}
              >
                <FileText className="h-3 w-3 shrink-0 text-muted/50" />
                <span className="truncate">{note.title}</span>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
