/**
 * 信息源管理主组件
 * 信息源列表 + 从渠道模板新建
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Plus,
  Rss,
  Trash2,
  Zap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Toast } from "@/components/ui/toast"
import { cn } from "@/src/lib/utils"
import { SourceCreateDialog } from "@/components/sources/source-create-dialog"
import type { ScoutChannel, ScoutCredential, ScoutSource } from "@/src/server/store/types"

interface Props {
  initialChannels: ScoutChannel[]
  initialSources: ScoutSource[]
  credentials: ScoutCredential[]
}

export function SourcesClient({ initialChannels, initialSources, credentials }: Props) {
  const [sources, setSources] = useState(initialSources)
  const [showCreate, setShowCreate] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ title: string; tone: "success" | "error" } | null>(null)

  const handleTest = useCallback(async (sourceId: string) => {
    setTestingId(sourceId)
    try {
      const res = await fetch(`/api/scout/sources/${sourceId}/test`, { method: "POST" })
      const data = await res.json()
      if (data.ok) {
        setToast({ title: `连接成功 — ${data.sampleTitles?.[0] ?? ""}`, tone: "success" })
        setSources((prev) => prev.map((s) =>
          s.id === sourceId ? { ...s, status: "active" as const, lastError: undefined } : s
        ))
      } else {
        setToast({ title: `连接失败: ${data.error}`, tone: "error" })
        setSources((prev) => prev.map((s) =>
          s.id === sourceId ? { ...s, status: "error" as const, lastError: data.error } : s
        ))
      }
    } catch {
      setToast({ title: "测试请求失败", tone: "error" })
    } finally {
      setTestingId(null)
    }
  }, [])

  const handleToggle = useCallback(async (sourceId: string) => {
    const source = sources.find((s) => s.id === sourceId)
    if (!source) return
    const newStatus = source.status === "active" ? "paused" : "active"
    try {
      const res = await fetch(`/api/scout/sources/${sourceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        const { item } = await res.json()
        setSources((prev) => prev.map((s) => (s.id === sourceId ? item : s)))
      }
    } catch {
      setToast({ title: "操作失败", tone: "error" })
    }
  }, [sources])

  const handleDelete = useCallback(async (sourceId: string) => {
    try {
      await fetch(`/api/scout/sources/${sourceId}`, { method: "DELETE" })
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
      setToast({ title: "已删除", tone: "success" })
    } catch {
      setToast({ title: "删除失败", tone: "error" })
    }
  }, [])

  const channelMap = Object.fromEntries(initialChannels.map((c) => [c.id, c]))

  return (
    <div className="min-h-screen bg-base px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">信息源</h1>
          <p className="mt-1 text-sm text-muted">
            管理已订阅的信息源，从内置渠道模板创建新信息源
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          从模板新建
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted">
          <Rss className="mb-3 h-8 w-8 opacity-30" />
          <p className="text-[14px]">暂无信息源</p>
          <p className="mt-1 text-[12px]">从内置渠道模板创建你的第一个信息源</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowCreate(true)}
            className="mt-4 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            开始创建
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => {
            const channel = channelMap[source.channelId]
            return (
              <SourceCard
                key={source.id}
                source={source}
                channelName={channel?.name ?? "未知渠道"}
                testing={testingId === source.id}
                onTest={handleTest}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            )
          })}
        </div>
      )}

      {showCreate && (
        <SourceCreateDialog
          channels={initialChannels}
          credentials={credentials}
          onClose={() => setShowCreate(false)}
          onCreated={(source) => {
            setSources((prev) => [source, ...prev])
            setShowCreate(false)
            setToast({ title: "信息源已创建", tone: "success" })
          }}
        />
      )}

      {toast && <Toast title={toast.title} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}

function SourceCard({
  source,
  channelName,
  testing,
  onTest,
  onToggle,
  onDelete
}: {
  source: ScoutSource
  channelName: string
  testing: boolean
  onTest: (id: string) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const statusConfig = {
    active: { label: "运行中", color: "bg-green-500/15 text-green-500", icon: CheckCircle2 },
    paused: { label: "已暂停", color: "bg-amber-500/15 text-amber-500", icon: Pause },
    error: { label: "异常", color: "bg-red-500/15 text-red-400", icon: AlertCircle }
  }[source.status]

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-medium text-foreground">{source.name}</h3>
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", statusConfig.color)}>
            {statusConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onTest(source.id)}
            disabled={testing}
            className="rounded-md p-1.5 text-muted hover:bg-overlay hover:text-foreground transition-colors disabled:opacity-50"
            title="测试连接"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onToggle(source.id)}
            className="rounded-md p-1.5 text-muted hover:bg-overlay hover:text-foreground transition-colors"
            title={source.status === "active" ? "暂停" : "启动"}
          >
            {source.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onDelete(source.id)}
            className="rounded-md p-1.5 text-muted hover:bg-overlay hover:text-red-400 transition-colors"
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <p className="mb-2 text-[12px] text-secondary">{channelName} · {source.protocol}</p>
      <p className="mb-3 truncate text-[11px] text-secondary" title={source.endpoint}>{source.endpoint}</p>

      {source.lastError && (
        <p className="mb-2 truncate text-[11px] text-red-400" title={source.lastError}>{source.lastError}</p>
      )}

      <div className="flex items-center justify-between text-[11px] text-secondary">
        <div className="flex items-center gap-4">
          <span>抓取 {source.totalFetched} 条</span>
          <span>Patch {source.totalPatches} 个</span>
          {source.lastFetchedAt && (
            <span>上次 {new Date(source.lastFetchedAt).toLocaleDateString()}</span>
          )}
        </div>
        {source.totalFetched > 0 && (
          <Link
            href={`/articles?sourceId=${source.id}`}
            className="flex items-center gap-1 text-primary/70 hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            查看文章
          </Link>
        )}
      </div>
    </Card>
  )
}
