/**
 * 任务管理面板
 * 任务卡片列表 + 新建/编辑任务
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useState, useCallback } from "react"
import {
  Clock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { cn } from "@/src/lib/utils"
import type { ScoutTask, ScoutSource, Viewpoint } from "@/src/server/store/types"

interface Props {
  tasks: ScoutTask[]
  sources: ScoutSource[]
  viewpoints: Viewpoint[]
  onTasksChange: (tasks: ScoutTask[]) => void
}

export function TaskManager({ tasks, sources, viewpoints, onTasksChange }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<ScoutTask | null>(null)
  const [toast, setToast] = useState<{ title: string; tone: "success" | "error" } | null>(null)

  const handleToggle = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/scout/tasks/${taskId}/toggle`, { method: "POST" })
      if (res.ok) {
        const { item } = await res.json()
        onTasksChange(tasks.map((t) => (t.id === taskId ? item : t)))
      }
    } catch {
      setToast({ title: "操作失败", tone: "error" })
    }
  }, [tasks, onTasksChange])

  const handleRun = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/scout/tasks/${taskId}/run`, { method: "POST" })
      if (res.ok) {
        setToast({ title: "任务已触发", tone: "success" })
      }
    } catch {
      setToast({ title: "触发失败", tone: "error" })
    }
  }, [])

  const handleDelete = useCallback(async (taskId: string) => {
    try {
      await fetch(`/api/scout/tasks/${taskId}`, { method: "DELETE" })
      onTasksChange(tasks.filter((t) => t.id !== taskId))
      setToast({ title: "已删除", tone: "success" })
    } catch {
      setToast({ title: "删除失败", tone: "error" })
    }
  }, [tasks, onTasksChange])

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[14px] font-medium text-foreground">
          搜寻任务 ({tasks.length})
        </h2>
        <Button
          size="sm"
          onClick={() => { setEditingTask(null); setShowForm(true) }}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          新建任务
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Settings2 className="mb-3 h-8 w-8 opacity-40" />
          <p className="text-[14px]">暂无搜寻任务</p>
          <p className="text-[12px]">创建任务后，Scout 将自动抓取互联网信息源</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              sources={sources}
              onToggle={handleToggle}
              onRun={handleRun}
              onDelete={handleDelete}
              onEdit={(t) => { setEditingTask(t); setShowForm(true) }}
            />
          ))}
        </div>
      )}

      {/* 新建/编辑表单 */}
      {showForm && (
        <TaskFormDialog
          task={editingTask}
          sources={sources}
          viewpoints={viewpoints}
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            try {
              if (editingTask) {
                const res = await fetch(`/api/scout/tasks/${editingTask.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data)
                })
                if (res.ok) {
                  const { item } = await res.json()
                  onTasksChange(tasks.map((t) => (t.id === editingTask.id ? item : t)))
                }
              } else {
                const res = await fetch("/api/scout/tasks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data)
                })
                if (res.ok) {
                  const { item } = await res.json()
                  onTasksChange([item, ...tasks])
                }
              }
              setShowForm(false)
              setToast({ title: editingTask ? "已更新" : "已创建", tone: "success" })
            } catch {
              setToast({ title: "保存失败", tone: "error" })
            }
          }}
        />
      )}

      {toast && <Toast title={toast.title} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}

function TaskCard({
  task,
  sources,
  onToggle,
  onRun,
  onDelete,
  onEdit
}: {
  task: ScoutTask
  sources: ScoutSource[]
  onToggle: (id: string) => void
  onRun: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (task: ScoutTask) => void
}) {
  const taskSources = sources.filter((s) => task.sourceIds.includes(s.id))

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-medium text-foreground">{task.name}</h3>
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            task.status === "active"
              ? "bg-green-500/15 text-green-400"
              : "bg-amber-500/15 text-amber-400"
          )}>
            {task.status === "active" ? "运行中" : "已暂停"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle(task.id)}
            className="rounded-md p-1.5 text-muted hover:bg-overlay hover:text-foreground transition-colors"
            title={task.status === "active" ? "暂停" : "启动"}
          >
            {task.status === "active" ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onRun(task.id)}
            className="rounded-md p-1.5 text-muted hover:bg-overlay hover:text-foreground transition-colors"
            title="立即执行"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(task)}
            className="rounded-md p-1.5 text-muted hover:bg-overlay hover:text-foreground transition-colors"
            title="编辑"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="rounded-md p-1.5 text-muted hover:bg-overlay hover:text-red-400 transition-colors"
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="mb-2 text-[12px] text-muted">{task.description}</p>
      )}

      {/* 信息源标签 */}
      <div className="mb-2 flex flex-wrap gap-1">
        {taskSources.map((s) => (
          <span
            key={s.id}
            className="rounded-md bg-overlay/60 px-2 py-0.5 text-[11px] text-muted"
          >
            {s.name}
          </span>
        ))}
      </div>

      {/* 统计 */}
      <div className="flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {task.lastRunAt
            ? `上次运行 ${new Date(task.lastRunAt).toLocaleString()}`
            : "从未运行"}
        </span>
        <span>共 {task.totalRuns} 次</span>
        <span>阈值 {Math.round(task.relevanceThreshold * 100)}%</span>
      </div>
    </div>
  )
}

/** 任务新建/编辑表单 */
function TaskFormDialog({
  task,
  sources,
  viewpoints,
  onClose,
  onSave
}: {
  task: ScoutTask | null
  sources: ScoutSource[]
  viewpoints: Viewpoint[]
  onClose: () => void
  onSave: (data: Record<string, any>) => void
}) {
  const [name, setName] = useState(task?.name ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [selectedSources, setSelectedSources] = useState<string[]>(task?.sourceIds ?? [])
  const [selectedViewpoints, setSelectedViewpoints] = useState<string[]>(task?.scopeViewpointIds ?? [])
  const [threshold, setThreshold] = useState(task?.relevanceThreshold ?? 0.6)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[520px] rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[16px] font-medium text-foreground">
            {task ? "编辑任务" : "新建搜寻任务"}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-secondary">任务名称</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：AI 前沿追踪" />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-secondary">描述（可选）</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="任务描述" />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-secondary">信息源</label>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSources((prev) =>
                      prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                    )
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[12px] transition-colors",
                    selectedSources.includes(s.id)
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border text-secondary hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {s.name}
                </button>
              ))}
              {sources.length === 0 && (
                <p className="text-[12px] text-muted">请先在设置中添加信息源</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-secondary">目标观点</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {viewpoints.filter((v) => !v.isFolder).map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedViewpoints((prev) =>
                      prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                    )
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[12px] transition-colors",
                    selectedViewpoints.includes(v.id)
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border text-secondary hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {v.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-secondary">
              相关度阈值：{Math.round(threshold * 100)}%
            </label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSave({
                name,
                description: description || undefined,
                sourceIds: selectedSources,
                scopeViewpointIds: selectedViewpoints,
                relevanceThreshold: threshold,
                maxPatchesPerRun: 20,
                status: task?.status ?? "active"
              })
            }}
            disabled={!name || selectedSources.length === 0}
          >
            {task ? "保存" : "创建"}
          </Button>
        </div>
      </div>
    </div>
  )
}
