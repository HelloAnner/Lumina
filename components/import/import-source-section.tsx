/**
 * 导入来源管理区块
 * 在设置页「同步与存储」下展示导入来源卡片列表及添加对话框
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/src/lib/utils"
import type { ImportSource } from "@/src/server/store/types"

export interface ImportSourceWithStats extends ImportSource {
  stats: {
    noteCount: number
    imageCount: number
    viewpointCount: number
  }
}

interface Props {
  sources: ImportSourceWithStats[]
}

export function ImportSourceSection({ sources: initialSources }: Props) {
  const router = useRouter()
  const [sources, setSources] = useState(initialSources)
  const [showDialog, setShowDialog] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const refreshSources = useCallback(async () => {
    try {
      const res = await fetch("/api/import/sources")
      if (res.ok) {
        const data = await res.json()
        setSources(data.items ?? [])
      }
    } catch {
      // 忽略
    }
  }, [])

  const handleSync = useCallback(async (sourceId: string) => {
    setSyncing(sourceId)
    try {
      const res = await fetch(`/api/import/sources/${sourceId}/sync`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        if (data.item?.id) {
          router.push(`/sources/import/${data.item.id}`)
        }
      }
    } catch {
      // 忽略
    } finally {
      setSyncing(null)
    }
  }, [router])

  const handleDelete = useCallback(async (sourceId: string) => {
    try {
      await fetch(`/api/import/sources/${sourceId}`, { method: "DELETE" })
      await refreshSources()
    } catch {
      // 忽略
    }
    setDeleteTarget(null)
  }, [refreshSources])

  const handleCreated = useCallback(async (jobId?: string) => {
    setShowDialog(false)
    await refreshSources()
    if (jobId) {
      router.push(`/sources/import/${jobId}`)
    }
  }, [refreshSources, router])

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">导入来源</h2>
            <p className="mt-0.5 text-xs text-muted">管理外部笔记来源，导入 Obsidian 等工具中的笔记</p>
          </div>
        </div>

        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            syncing={syncing === source.id}
            onSync={() => handleSync(source.id)}
            onDelete={() => setDeleteTarget(source.id)}
          />
        ))}

        <button
          onClick={() => setShowDialog(true)}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-[13px] text-muted transition-colors hover:border-border-hover hover:text-secondary"
        >
          <Plus className="h-4 w-4" />
          添加来源
        </button>
      </div>

      {showDialog && (
        <AddSourceDialog
          onClose={() => setShowDialog(false)}
          onCreated={handleCreated}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除导入来源"
        description="删除后将同时移除该来源下所有导入的笔记和关联数据，此操作不可撤销。"
        variant="danger"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

/** 来源卡片 */
function SourceCard({
  source,
  syncing,
  onSync,
  onDelete
}: {
  source: ImportSourceWithStats
  syncing: boolean
  onSync: () => void
  onDelete: () => void
}) {
  return (
    <Card className="p-5 space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-4 w-4 text-accent-purple" />
          <span className="text-sm font-medium">{source.name}</span>
        </div>
        {source.lastSyncAt && (
          <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] text-success">
            已同步
          </span>
        )}
      </div>

      <div className="border-t border-border/40" />

      {/* 统计 */}
      <div className="flex gap-6">
        <StatItem label="笔记" value={source.stats.noteCount} />
        <StatItem label="图片" value={source.stats.imageCount} />
        <StatItem label="观点" value={source.stats.viewpointCount} />
      </div>

      {/* 底部操作 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {source.lastSyncAt
            ? `上次同步：${new Date(source.lastSyncAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`
            : "尚未同步"
          }
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-secondary transition-colors hover:bg-elevated disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            同步
          </button>
          <button
            onClick={onDelete}
            className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-error/70 transition-colors hover:bg-error/5 hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </button>
        </div>
      </div>
    </Card>
  )
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

/** 复用独立的 AddSourceDialog 组件 */
import { AddSourceDialog } from "@/components/import/add-source-dialog"
