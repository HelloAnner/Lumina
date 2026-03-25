/**
 * 文件夹选择器
 * 通过服务端 API 浏览本机目录结构，选择目标文件夹
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ChevronUp,
  Folder,
  FolderOpen,
  Loader2,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/src/lib/utils"

interface DirEntry {
  name: string
  path: string
}

interface Props {
  onSelect: (path: string) => void
  onClose: () => void
}

export function FolderPicker({ onSelect, onClose }: Props) {
  const [current, setCurrent] = useState("")
  const [parent, setParent] = useState("")
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const browse = useCallback(async (path?: string) => {
    setLoading(true)
    setError("")
    try {
      const url = path
        ? `/api/system/browse?path=${encodeURIComponent(path)}`
        : "/api/system/browse"
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "无法访问目录")
        setLoading(false)
        return
      }
      const data = await res.json()
      setCurrent(data.current)
      setParent(data.parent)
      setEntries(data.entries ?? [])
    } catch {
      setError("网络错误")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void browse()
  }, [browse])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-[520px] flex-col rounded-2xl border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: "70vh" }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
          <h3 className="text-sm font-medium">选择文件夹</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 路径导航 */}
        <div className="flex items-center gap-2 border-b border-border/30 px-5 py-2.5">
          <button
            onClick={() => void browse(parent)}
            disabled={current === parent || loading}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-30"
            title="上级目录"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 rounded-md bg-elevated px-3 py-1.5 font-mono text-xs text-secondary truncate">
            {current || "..."}
          </div>
        </div>

        {/* 目录列表 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          ) : error ? (
            <p className="px-2 py-8 text-center text-xs text-error">{error}</p>
          ) : entries.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-muted">此目录下没有子文件夹</p>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.path}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-secondary transition-colors hover:bg-overlay/60 hover:text-foreground"
                onDoubleClick={() => void browse(entry.path)}
                onClick={() => void browse(entry.path)}
              >
                <Folder className="h-4 w-4 shrink-0 text-muted/60" />
                <span className="truncate">{entry.name}</span>
              </button>
            ))
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between border-t border-border/40 px-5 py-3">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-4">
            <FolderOpen className="h-4 w-4 shrink-0 text-accent-purple" />
            <span className="truncate font-mono text-xs text-muted">{current}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
              className="h-[34px] rounded-sm px-4 text-[13px]"
            >
              取消
            </Button>
            <Button
              onClick={() => onSelect(current)}
              disabled={!current}
              className="h-[34px] rounded-sm bg-accent-blue px-4 text-[13px] font-medium text-white hover:bg-accent-blue/90"
            >
              选择此文件夹
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
