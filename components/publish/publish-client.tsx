"use client"

import { useCallback, useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  FileText,
  Globe,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  X,
  XCircle,
  AlertCircle,
  Calendar,
  Filter,
  Layers,
  Target,
  Zap,
  ArrowRight,
  MoreHorizontal,
  Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/src/lib/utils"
import type { PublishRecord, PublishTarget, PublishTask, Viewpoint, TriggerType, PublishFormat } from "@/src/server/store/types"

type TabType = "tasks" | "targets"
type StatusFilter = "all" | "success" | "failed" | "running"

interface Toast {
  id: string
  type: "success" | "error" | "info"
  message: string
}

// 动画过渡配置
const transitions = {
  fast: "transition-all duration-150 ease-out",
  normal: "transition-all duration-200 ease-out",
  slow: "transition-all duration-300 ease-out"
}

export function PublishClient({
  viewpoints,
  targets,
  tasks,
  initialRecords
}: {
  viewpoints: Viewpoint[]
  targets: PublishTarget[]
  tasks: PublishTask[]
  initialRecords: PublishRecord[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("tasks")
  const [activeTask, setActiveTask] = useState<PublishTask | undefined>(tasks[0])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // 表单状态
  const [taskName, setTaskName] = useState("")
  const [targetName, setTargetName] = useState("")
  const [targetUrl, setTargetUrl] = useState("https://example.com/webhook")
  const [selectedViewpointIds, setSelectedViewpointIds] = useState<string[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string>("")
  const [selectedFormat, setSelectedFormat] = useState<PublishFormat>("markdown")
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType>("manual")
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isCreatingTarget, setIsCreatingTarget] = useState(false)

  // 编辑状态
  const [editingTask, setEditingTask] = useState<PublishTask | null>(null)
  const [editingTarget, setEditingTarget] = useState<PublishTarget | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)

  // 下拉菜单状态
  const [showViewpointDropdown, setShowViewpointDropdown] = useState(false)

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description?: string
    variant: "default" | "danger"
    onConfirm: () => void
  } | null>(null)

  // 计算过滤后的记录
  const records = useMemo(() => {
    let filtered = initialRecords.filter((item) => item.taskId === activeTask?.id)
    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status.toLowerCase() === statusFilter.toUpperCase())
    }
    return filtered.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
  }, [activeTask, initialRecords, statusFilter])

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest("[data-viewpoint-dropdown]")) {
        setShowViewpointDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // 显示 Toast 提示
  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  // 创建目标
  async function createTarget() {
    if (!targetName.trim()) {
      showToast("error", "请输入目标名称")
      return
    }
    setIsCreatingTarget(true)
    try {
      const response = await fetch("/api/publish/targets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: targetName.trim(),
          type: "webhook",
          endpointUrl: targetUrl
        })
      })
      if (response.ok) {
        setTargetName("")
        setTargetUrl("https://example.com/webhook")
        showToast("success", "发布目标已创建")
        router.refresh()
      } else {
        showToast("error", "创建失败")
      }
    } catch {
      showToast("error", "网络错误")
    } finally {
      setIsCreatingTarget(false)
    }
  }

  // 更新目标
  async function updateTarget(targetId: string, updates: Partial<PublishTarget>) {
    try {
      const response = await fetch(`/api/publish/targets/${targetId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates)
      })
      if (response.ok) {
        setEditingTarget(null)
        showToast("success", "目标已更新")
        router.refresh()
      } else {
        showToast("error", "更新失败")
      }
    } catch {
      showToast("error", "网络错误")
    }
  }

  // 删除目标
  async function deleteTarget(targetId: string) {
    const target = targets.find((t) => t.id === targetId)
    setConfirmDialog({
      open: true,
      title: "删除发布目标",
      description: `确认删除发布目标「${target?.name ?? "未命名"}」吗？`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmDialog(null)
        setDeletingId(targetId)
        try {
          const response = await fetch(`/api/publish/targets/${targetId}`, {
            method: "DELETE"
          })
          if (response.ok) {
            showToast("success", "目标已删除")
            router.refresh()
          } else {
            showToast("error", "删除失败")
          }
        } catch {
          showToast("error", "网络错误")
        } finally {
          setDeletingId(null)
        }
      }
    })
  }

  // 创建任务
  async function createTask() {
    if (targets.length === 0) {
      showToast("error", "请先创建发布目标")
      setActiveTab("targets")
      return
    }
    if (viewpoints.length === 0) {
      showToast("error", "知识库中还没有观点")
      return
    }

    const viewpointIds = selectedViewpointIds.length > 0 ? selectedViewpointIds : [viewpoints[0].id]
    const targetId = selectedTargetId || targets[0]?.id

    setIsCreatingTask(true)
    try {
      const response = await fetch("/api/publish/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: taskName.trim() || "新任务",
          viewpointIds,
          targetId,
          format: selectedFormat,
          triggerType: selectedTrigger,
          enabled: true
        })
      })
      if (response.ok) {
        const data = await response.json()
        setTaskName("")
        setSelectedViewpointIds([])
        showToast("success", "发布任务已创建")
        setActiveTask(data.item)
        router.refresh()
      } else {
        showToast("error", "创建失败")
      }
    } catch {
      showToast("error", "网络错误")
    } finally {
      setIsCreatingTask(false)
    }
  }

  // 更新任务
  async function updateTask(taskId: string, updates: Partial<PublishTask>) {
    try {
      const response = await fetch(`/api/publish/tasks/${taskId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates)
      })
      if (response.ok) {
        setEditingTask(null)
        showToast("success", "任务已更新")
        router.refresh()
      } else {
        showToast("error", "更新失败")
      }
    } catch {
      showToast("error", "网络错误")
    }
  }

  // 删除任务
  async function deleteTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    setConfirmDialog({
      open: true,
      title: "删除发布任务",
      description: `确认删除发布任务「${task?.name ?? "未命名"}」吗？`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmDialog(null)
        setDeletingId(taskId)
        try {
          const response = await fetch(`/api/publish/tasks/${taskId}`, {
            method: "DELETE"
          })
          if (response.ok) {
            if (activeTask?.id === taskId) {
              setActiveTask(tasks.find((t) => t.id !== taskId))
            }
            showToast("success", "任务已删除")
            router.refresh()
          } else {
            showToast("error", "删除失败")
          }
        } catch {
          showToast("error", "网络错误")
        } finally {
          setDeletingId(null)
        }
      }
    })
  }

  // 触发任务
  async function triggerTask(taskId: string) {
    setTriggeringId(taskId)
    try {
      const response = await fetch(`/api/publish/tasks/${taskId}/trigger`, {
        method: "POST"
      })
      if (response.ok) {
        showToast("success", "发布任务已触发")
        router.refresh()
      } else {
        showToast("error", "触发失败")
      }
    } catch {
      showToast("error", "网络错误")
    } finally {
      setTriggeringId(null)
    }
  }

  // 格式化时间
  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "刚刚"
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}d`
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
  }

  // 状态配置
  function getStatusConfig(status: PublishRecord["status"]) {
    switch (status) {
      case "SUCCESS":
        return {
          icon: CheckCircle2,
          color: "text-success",
          bgColor: "bg-success/10",
          borderColor: "border-success/20",
          glowColor: "shadow-success/20",
          label: "成功"
        }
      case "FAILED":
        return {
          icon: XCircle,
          color: "text-error",
          bgColor: "bg-error/10",
          borderColor: "border-error/20",
          glowColor: "shadow-error/20",
          label: "失败"
        }
      case "RUNNING":
        return {
          icon: RefreshCw,
          color: "text-warning",
          bgColor: "bg-warning/10",
          borderColor: "border-warning/20",
          glowColor: "shadow-warning/20",
          label: "运行中"
        }
      default:
        return {
          icon: AlertCircle,
          color: "text-muted",
          bgColor: "bg-elevated",
          borderColor: "border-border/40",
          glowColor: "",
          label: "未知"
        }
    }
  }

  // 触发类型标签
  function getTriggerBadge(triggerType: TriggerType) {
    const config = {
      manual: { icon: Zap, color: "text-accent-purple", bg: "bg-accent-purple/10", border: "border-accent-purple/20" },
      cron: { icon: Calendar, color: "text-accent-blue", bg: "bg-accent-blue/10", border: "border-accent-blue/20" },
      on_change: { icon: RefreshCw, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" }
    }
    const { icon: Icon, color, bg, border } = config[triggerType]
    const labels: Record<TriggerType, string> = { manual: "手动", cron: "定时", on_change: "变更" }
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", bg, border, color)}>
        <Icon className="h-3 w-3" />
        {labels[triggerType]}
      </span>
    )
  }

  // 格式标签
  function getFormatBadge(format: PublishFormat) {
    const labels: Record<PublishFormat, string> = { markdown: "MD", html: "HTML", pdf: "PDF" }
    return (
      <span className="inline-flex items-center rounded-full border border-border/40 bg-elevated/50 px-2 py-0.5 text-[11px] font-medium text-muted">
        {labels[format]}
      </span>
    )
  }

  // 目标类型图标
  function getTargetIcon(type: PublishTarget["type"]) {
    return type === "webhook" ? Webhook : Globe
  }

  // 切换观点选择
  function toggleViewpoint(viewpointId: string) {
    setSelectedViewpointIds(prev =>
      prev.includes(viewpointId)
        ? prev.filter(id => id !== viewpointId)
        : [...prev, viewpointId]
    )
  }

  return (
    <div className="flex min-h-screen bg-base">
      {/* Toast 容器 */}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm",
              "transform transition-all duration-300 ease-out",
              "animate-in slide-in-from-right-2 fade-in",
              toast.type === "success" && "border-success/20 bg-success/10 text-success",
              toast.type === "error" && "border-error/20 bg-error/10 text-error",
              toast.type === "info" && "border-primary/20 bg-primary/10 text-primary"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full",
              toast.type === "success" && "bg-success/20",
              toast.type === "error" && "bg-error/20",
              toast.type === "info" && "bg-primary/20"
            )}>
              {toast.type === "success" && <Check className="h-3.5 w-3.5" />}
              {toast.type === "error" && <X className="h-3.5 w-3.5" />}
              {toast.type === "info" && <AlertCircle className="h-3.5 w-3.5" />}
            </div>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        open={confirmDialog?.open ?? false}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description}
        variant={confirmDialog?.variant ?? "default"}
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={confirmDialog?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />

      {/* 左侧边栏 */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-border/40 bg-surface/80 backdrop-blur-xl",
          "transition-all duration-300 ease-out",
          isSidebarCollapsed ? "w-16" : "w-[340px]"
        )}
      >
        {/* 头部标签页 */}
        <div className="flex h-14 items-center border-b border-border/40 px-3">
          <div className="flex w-full rounded-lg bg-elevated/60 p-1">
            <button
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                activeTab === "tasks"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-secondary"
              )}
              onClick={() => setActiveTab("tasks")}
            >
              <Layers className="h-3.5 w-3.5" />
              {!isSidebarCollapsed && (
                <>
                  任务
                  <span className="ml-1 rounded-full bg-elevated px-1.5 py-0 text-[10px] tabular-nums text-muted">{tasks.length}</span>
                </>
              )}
            </button>
            <button
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                activeTab === "targets"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-secondary"
              )}
              onClick={() => setActiveTab("targets")}
            >
              <Target className="h-3.5 w-3.5" />
              {!isSidebarCollapsed && (
                <>
                  目标
                  <span className="ml-1 rounded-full bg-elevated px-1.5 py-0 text-[10px] tabular-nums text-muted">{targets.length}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 任务列表 */}
        {activeTab === "tasks" && !isSidebarCollapsed && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* 创建任务表单 */}
            <div className="border-b border-border/40 p-3">
              <div className="space-y-2">
                <Input
                  placeholder="新任务名称..."
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createTask() }}
                  className="h-8 text-xs"
                />

                {/* 观点选择下拉 */}
                {viewpoints.length > 0 && (
                  <div className="relative" data-viewpoint-dropdown>
                    <button
                      className={cn(
                        "flex h-8 w-full items-center justify-between rounded-lg border px-2.5 text-xs transition-all",
                        showViewpointDropdown
                          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/50 bg-elevated/50 hover:border-border/60"
                      )}
                      onClick={() => setShowViewpointDropdown(!showViewpointDropdown)}
                    >
                      <span className={cn("truncate", selectedViewpointIds.length === 0 && "text-muted")}>
                        {selectedViewpointIds.length === 0
                          ? "选择来源观点..."
                          : `已选择 ${selectedViewpointIds.length} 个观点`
                        }
                      </span>
                      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", showViewpointDropdown && "rotate-180")} />
                    </button>

                    {showViewpointDropdown && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-surface/95 p-1 shadow-2xl backdrop-blur-xl">
                        {viewpoints.map((vp) => (
                          <button
                            key={vp.id}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                              selectedViewpointIds.includes(vp.id)
                                ? "bg-primary/10 text-primary"
                                : "text-secondary hover:bg-elevated"
                            )}
                            onClick={() => toggleViewpoint(vp.id)}
                          >
                            <div className={cn(
                              "flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors",
                              selectedViewpointIds.includes(vp.id)
                                ? "border-primary bg-primary"
                                : "border-border/60"
                            )}>
                              {selectedViewpointIds.includes(vp.id) && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <span className="truncate">{vp.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <select
                    className="h-8 flex-1 rounded-lg border border-border/50 bg-elevated/50 px-2.5 text-xs text-secondary outline-none transition-all hover:border-border/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value as PublishFormat)}
                  >
                    <option value="markdown">Markdown</option>
                    <option value="html">HTML</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <select
                    className="h-8 flex-1 rounded-lg border border-border/50 bg-elevated/50 px-2.5 text-xs text-secondary outline-none transition-all hover:border-border/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                    value={selectedTrigger}
                    onChange={(e) => setSelectedTrigger(e.target.value as TriggerType)}
                  >
                    <option value="manual">手动触发</option>
                    <option value="cron">定时触发</option>
                    <option value="on_change">变更触发</option>
                  </select>
                </div>
                <Button
                  className="w-full gap-1.5"
                  size="sm"
                  onClick={createTask}
                  disabled={targets.length === 0 || viewpoints.length === 0 || isCreatingTask}
                >
                  {isCreatingTask ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  创建任务
                </Button>
              </div>
            </div>

            {/* 任务列表 */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated/50">
                      <Layers className="h-5 w-5 text-muted/50" />
                    </div>
                    <p className="mt-3 text-xs font-medium text-muted">还没有发布任务</p>
                    <p className="mt-0.5 text-[11px] text-muted">创建一个任务来开始自动发布</p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "group relative rounded-xl border p-2.5 transition-all duration-200",
                        activeTask?.id === task.id
                          ? "border-primary/30 bg-primary/[0.04] shadow-sm shadow-primary/5"
                          : "border-transparent bg-elevated/30 hover:border-border/50 hover:bg-elevated/50"
                      )}
                    >
                      <button
                        className="w-full text-left"
                        onClick={() => setActiveTask(task)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{task.name}</span>
                          <div className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            task.enabled ? "bg-success shadow-[0_0_6px_rgba(107,200,155,0.4)]" : "bg-muted/50"
                          )} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {getTriggerBadge(task.triggerType)}
                          {getFormatBadge(task.format)}
                        </div>
                      </button>

                      {/* 操作按钮 */}
                      <div className={cn(
                        "absolute right-2 top-2 flex items-center gap-0.5 rounded-lg bg-surface/80 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-all",
                        activeTask?.id === task.id && "opacity-100",
                        "group-hover:opacity-100"
                      )}>
                        <button
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-all hover:bg-elevated hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); setEditingTask(task) }}
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-all hover:bg-error/10 hover:text-error"
                          onClick={(e) => { e.stopPropagation(); void deleteTask(task.id) }}
                          disabled={deletingId === task.id}
                        >
                          {deletingId === task.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 目标列表 */}
        {activeTab === "targets" && !isSidebarCollapsed && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* 创建目标表单 */}
            <div className="border-b border-border/40 p-3">
              <div className="space-y-2">
                <Input
                  placeholder="目标名称..."
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createTarget() }}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Webhook URL..."
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  className="w-full gap-1.5"
                  size="sm"
                  onClick={createTarget}
                  disabled={isCreatingTarget}
                >
                  {isCreatingTarget ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  创建目标
                </Button>
              </div>
            </div>

            {/* 目标列表 */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {targets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated/50">
                      <Target className="h-5 w-5 text-muted/50" />
                    </div>
                    <p className="mt-3 text-xs font-medium text-muted">还没有发布目标</p>
                    <p className="mt-0.5 text-[11px] text-muted">创建一个目标来接收发布内容</p>
                  </div>
                ) : (
                  targets.map((target) => {
                    const TargetIcon = getTargetIcon(target.type)
                    return (
                      <div
                        key={target.id}
                        className="group relative rounded-xl border border-transparent bg-elevated/30 p-2.5 transition-all duration-200 hover:border-border/50 hover:bg-elevated/50"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                            <TargetIcon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{target.name}</p>
                            <p className="truncate text-[11px] text-muted">{target.endpointUrl}</p>
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-lg bg-surface/80 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-all group-hover:opacity-100">
                          <button
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-all hover:bg-elevated hover:text-foreground"
                            onClick={() => setEditingTarget(target)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-all hover:bg-error/10 hover:text-error"
                            onClick={() => void deleteTarget(target.id)}
                            disabled={deletingId === target.id}
                          >
                            {deletingId === target.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 折叠按钮 */}
        <div className="border-t border-border/40 p-2">
          <button
            className="flex h-8 w-full items-center justify-center rounded-lg text-muted transition-all hover:bg-elevated hover:text-secondary"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          >
            <ArrowRight className={cn("h-4 w-4 transition-transform duration-300", !isSidebarCollapsed && "rotate-180")} />
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex min-w-0 flex-1 flex-col bg-base">
        {activeTask ? (
          <>
            {/* 任务详情头部 */}
            <div className="border-b border-border/40 bg-surface/30 px-8 py-6 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-lg font-semibold tracking-tight">{activeTask.name}</h1>
                    {activeTask.enabled ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-[11px] font-medium text-success">
                        <span className="h-1 w-1 rounded-full bg-success shadow-[0_0_6px_rgba(107,200,155,0.4)]" />
                        已启用
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-elevated/50 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                        <span className="h-1 w-1 rounded-full bg-muted/50" />
                        已禁用
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {getTriggerBadge(activeTask.triggerType)}
                    {getFormatBadge(activeTask.format)}
                    <span className="text-xs text-muted">
                      <span className="font-medium text-secondary">{viewpoints.filter((v) => activeTask.viewpointIds.includes(v.id)).length}</span> 个来源观点
                    </span>
                    <span className="text-xs text-muted">·</span>
                    <span className="text-xs text-muted">
                      目标: <span className="text-secondary">{targets.find((t) => t.id === activeTask.targetId)?.name ?? "未知"}</span>
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => void triggerTask(activeTask.id)}
                  disabled={triggeringId === activeTask.id || !activeTask.enabled}
                  className="gap-2"
                >
                  {triggeringId === activeTask.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  立即发布
                </Button>
              </div>
            </div>

            {/* 发布历史 */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <Card className="overflow-hidden border-border/40 bg-surface/30 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-surface/50 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-elevated/50">
                      <Clock className="h-3.5 w-3.5 text-muted" />
                    </div>
                    <span className="text-sm font-medium">发布历史</span>
                    <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
                      {records.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted" />
                    <select
                      className="h-8 rounded-lg border border-border/50 bg-elevated/50 px-2.5 text-xs text-secondary outline-none transition-all hover:border-border/60 focus:border-primary/40"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    >
                      <option value="all">全部状态</option>
                      <option value="success">成功</option>
                      <option value="failed">失败</option>
                      <option value="running">运行中</option>
                    </select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {records.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-elevated/50">
                        <Clock className="h-7 w-7 text-muted/30" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-muted">暂无发布记录</p>
                      <p className="mt-1 text-xs text-muted">点击「立即发布」来触发第一次发布</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {records.map((record, index) => {
                        const config = getStatusConfig(record.status)
                        const StatusIcon = config.icon
                        return (
                          <div
                            key={record.id}
                            className={cn(
                              "group flex items-center gap-4 px-5 py-4 transition-all duration-200",
                              "hover:bg-surface/50",
                              record.status === "RUNNING" && "bg-warning/[0.02]"
                            )}
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <div className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-300",
                              config.bgColor,
                              config.borderColor,
                              config.glowColor && `shadow-lg ${config.glowColor}`
                            )}>
                              <StatusIcon className={cn("h-4 w-4", config.color, record.status === "RUNNING" && "animate-spin")} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-4">
                                <span className={cn("text-sm font-medium", config.color)}>
                                  {config.label}
                                </span>
                                <span className="shrink-0 text-[11px] tabular-nums text-muted">
                                  {formatTime(record.executedAt)}
                                </span>
                              </div>
                              {record.errorMsg && (
                                <p className="mt-1 text-xs text-error/90">{record.errorMsg}</p>
                              )}
                              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
                                <span>触发: <span className="text-muted">{record.triggeredBy}</span></span>
                                <span className="h-0.5 w-0.5 rounded-full bg-muted/30" />
                                <span className="font-mono">{record.articleVersion.slice(0, 7)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          /* 空状态 */
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-3xl" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                <Layers className="h-10 w-10 text-primary/80" />
              </div>
            </div>
            <h2 className="mt-8 text-lg font-semibold">选择或创建一个发布任务</h2>
            <p className="mt-2 max-w-xs text-center text-sm leading-relaxed text-muted/80">
              发布任务可以自动将你的知识库观点发布到指定的目标平台
            </p>
            <Button className="mt-6 gap-2" onClick={() => setActiveTab("tasks")}>
              <Plus className="h-4 w-4" />
              创建第一个任务
            </Button>
          </div>
        )}
      </main>

      {/* 编辑任务弹窗 */}
      {editingTask && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-base/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingTask(null) }}
        >
          <div className="w-full max-w-sm scale-100 rounded-2xl border border-border/50 bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Edit3 className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-base font-semibold">编辑任务</h3>
              </div>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-all hover:bg-elevated hover:text-foreground"
                onClick={() => setEditingTask(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-secondary">任务名称</label>
                <Input
                  value={editingTask.name}
                  onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                  className="h-9"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/40 bg-elevated/30 p-3 transition-all hover:bg-elevated/50">
                <div className={cn(
                  "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                  editingTask.enabled ? "bg-success/80" : "bg-muted/30"
                )}>
                  <div className={cn(
                    "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                    editingTask.enabled ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
                <input
                  type="checkbox"
                  checked={editingTask.enabled}
                  onChange={(e) => setEditingTask({ ...editingTask, enabled: e.target.checked })}
                  className="sr-only"
                />
                <span className="text-sm">启用任务</span>
              </label>
              <div className="flex gap-2 pt-1">
                <Button variant="secondary" className="flex-1" size="sm" onClick={() => setEditingTask(null)}>
                  取消
                </Button>
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={() => void updateTask(editingTask.id, {
                    name: editingTask.name,
                    enabled: editingTask.enabled
                  })}
                >
                  保存
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑目标弹窗 */}
      {editingTarget && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-base/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingTarget(null) }}
        >
          <div className="w-full max-w-sm scale-100 rounded-2xl border border-border/50 bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Edit3 className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-base font-semibold">编辑目标</h3>
              </div>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-all hover:bg-elevated hover:text-foreground"
                onClick={() => setEditingTarget(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-secondary">目标名称</label>
                <Input
                  value={editingTarget.name}
                  onChange={(e) => setEditingTarget({ ...editingTarget, name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-secondary">Webhook URL</label>
                <Input
                  value={editingTarget.endpointUrl}
                  onChange={(e) => setEditingTarget({ ...editingTarget, endpointUrl: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="secondary" className="flex-1" size="sm" onClick={() => setEditingTarget(null)}>
                  取消
                </Button>
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={() => void updateTarget(editingTarget.id, {
                    name: editingTarget.name,
                    endpointUrl: editingTarget.endpointUrl
                  })}
                >
                  保存
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
