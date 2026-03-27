/**
 * 导入笔记查看器
 * 加载并渲染选中的导入笔记详情
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import {
  type RefObject,
  useEffect,
  useState
} from "react"
import { FileText, Loader2, Tag } from "lucide-react"
import { ImportedBlockList } from "@/components/import/imported-note-blocks"
import type { ImportedNote } from "@/src/server/store/types"

const importedNoteCache = new Map<string, ImportedNote>()
const importedNoteRequestCache = new Map<string, Promise<ImportedNote | null>>()

export async function fetchImportedNote(noteId: string) {
  const cached = importedNoteCache.get(noteId)
  if (cached) {
    return cached
  }
  const pending = importedNoteRequestCache.get(noteId)
  if (pending) {
    return pending
  }
  const request = (async () => {
    const res = await fetch(`/api/import/notes/${noteId}`)
    if (!res.ok) {
      return null
    }
    const data = await res.json()
    const note = (data.item ?? null) as ImportedNote | null
    if (note) {
      importedNoteCache.set(noteId, note)
    }
    return note
  })()
  importedNoteRequestCache.set(noteId, request)
  try {
    return await request
  } finally {
    importedNoteRequestCache.delete(noteId)
  }
}

interface Props {
  noteId: string
  scrollContainerRef?: RefObject<HTMLDivElement>
  onReady?: () => void
}

export function ImportedNoteViewer({
  noteId,
  scrollContainerRef,
  onReady
}: Props) {
  const [note, setNote] = useState<ImportedNote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = importedNoteCache.get(noteId)
    if (cached) {
      setNote(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    let cancelled = false
    void (async () => {
      try {
        const nextNote = await fetchImportedNote(noteId)
        if (!cancelled) {
          setNote(nextNote)
        }
      } catch {
        if (!cancelled) {
          setNote(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [noteId])

  useEffect(() => {
    if (!loading && note) {
      onReady?.()
    }
  }, [loading, note, onReady])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    )
  }

  if (!note) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <FileText className="h-6 w-6 text-muted/40" />
        <p className="text-sm text-muted">笔记不存在或已删除</p>
      </div>
    )
  }

  return (
    <>
      {/* 顶部标题栏 */}
      <div className="flex h-11 shrink-0 items-center border-b border-border/40 bg-surface px-6">
        <span className="text-[15px] font-semibold text-foreground truncate">
          {note.title}
        </span>
      </div>

      {/* 元信息 */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/30 bg-surface/80 px-6 py-1.5">
        <span className="text-[11px] text-muted">
          {new Date(note.importedAt).toLocaleDateString("zh-CN")}
        </span>
        {note.tags.length > 0 && (
          <>
            <span className="text-muted">·</span>
            <div className="flex items-center gap-1.5 overflow-hidden">
              {note.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-accent-blue/10 px-2 py-0.5 text-[10px] text-accent-blue"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
              {note.tags.length > 3 && (
                <span className="text-[10px] text-muted">+{note.tags.length - 3}</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* 笔记内容 */}
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-2xl px-8 py-8">
          <ImportedBlockList blocks={note.blocks} />
        </div>
      </div>

      {/* 底部状态 */}
      <div className="flex h-8 shrink-0 items-center justify-end border-t border-border/30 bg-surface/80 px-6">
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span>{note.blocks.length} 个块</span>
          {note.imageKeys.length > 0 && (
            <span>{note.imageKeys.length} 张图片</span>
          )}
        </div>
      </div>
    </>
  )
}
