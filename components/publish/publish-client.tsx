"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/src/lib/utils"
import type { PublishRecord, PublishTarget, PublishTask, Viewpoint } from "@/src/server/store/types"

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
  const [activeTask, setActiveTask] = useState(tasks[0])
  const [taskName, setTaskName] = useState("")
  const [targetName, setTargetName] = useState("")
  const [targetUrl, setTargetUrl] = useState("https://example.com/webhook")

  const records = useMemo(
    () => initialRecords.filter((item) => item.taskId === activeTask?.id),
    [activeTask, initialRecords]
  )

  async function createTarget() {
    await fetch("/api/publish/targets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: targetName || "新目标",
        type: "webhook",
        endpointUrl: targetUrl
      })
    })
    router.refresh()
  }

  async function createTask() {
    if (targets.length === 0 || viewpoints.length === 0) {
      return
    }
    await fetch("/api/publish/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: taskName || "新任务",
        viewpointIds: [viewpoints[0].id],
        targetId: targets[0].id,
        format: "markdown",
        triggerType: "manual",
        enabled: true
      })
    })
    router.refresh()
  }

  async function triggerTask(taskId: string) {
    await fetch(`/api/publish/tasks/${taskId}/trigger`, {
      method: "POST"
    })
    router.refresh()
  }

  return (
    <div className="grid min-h-screen grid-cols-[320px_minmax(0,1fr)] gap-6 bg-base px-8 py-8">
      {/* Left Sidebar */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button className="flex-1 gap-1.5" onClick={createTarget}>
            <span className="text-base leading-none">+</span>
            新建目标
          </Button>
          <Button className="flex-1 gap-1.5" variant="secondary" onClick={createTask}>
            <span className="text-base leading-none">+</span>
            新建任务
          </Button>
        </div>
        <Card className="space-y-3 border-border/60 p-4">
          <Input
            placeholder="目标名称"
            value={targetName}
            onChange={(event) => setTargetName(event.target.value)}
          />
          <Input
            placeholder="Webhook URL"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
          />
          <Input
            placeholder="任务名称"
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
          />
        </Card>
        <div className="space-y-2">
          {tasks.map((task) => (
            <button
              key={task.id}
              className={cn(
                "w-full rounded-lg border p-4 text-left transition-all duration-200",
                activeTask?.id === task.id
                  ? "border-secondary/50 bg-elevated"
                  : "border-border/60 bg-surface hover:border-border hover:bg-elevated/50"
              )}
              onClick={() => setActiveTask(task)}
            >
              <div className="flex items-center gap-2">
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  activeTask?.id === task.id ? "bg-secondary" : "bg-muted/50"
                )} />
                <span className="text-sm font-medium">{task.name}</span>
              </div>
              <div className="mt-2 pl-4 text-xs text-muted">
                {task.triggerType} · {task.format}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        <Card className="space-y-4 border-border/60 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{activeTask?.name ?? "发布配置"}</h1>
              <p className="mt-1 text-sm text-muted">
                选择来源观点、目标平台与触发方式。
              </p>
            </div>
            {activeTask ? (
              <Button onClick={() => triggerTask(activeTask.id)}>手动触发</Button>
            ) : null}
          </div>
          <Textarea
            readOnly
            className="bg-elevated/50"
            value={`目标数量：${targets.length}\n观点数量：${viewpoints.length}\n当前任务来源：${activeTask?.viewpointIds.join(", ") ?? "-"}`}
          />
        </Card>

        <Card className="space-y-4 border-border/60 p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary/60" />
            发布历史
          </div>
          <div className="space-y-2">
            {records.length === 0 ? (
              <div className="rounded-lg border border-border/60 border-dashed p-6 text-center text-sm text-muted">
                暂无发布记录
              </div>
            ) : (
              records.map((record) => (
                <div key={record.id} className="rounded-lg border border-border/60 bg-elevated/30 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "font-medium",
                      record.status === "SUCCESS" ? "text-foreground" : "text-muted"
                    )}>
                      {record.status}
                    </span>
                    <span className="text-xs text-muted">{record.executedAt}</span>
                  </div>
                  {record.errorMsg ? (
                    <p className="mt-2 text-xs text-red-400">{record.errorMsg}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
