"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={createTarget}>
            + 新建目标
          </Button>
          <Button className="flex-1" variant="secondary" onClick={createTask}>
            + 新建任务
          </Button>
        </div>
        <Card className="space-y-3 p-4">
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
        <div className="space-y-3">
          {tasks.map((task) => (
            <button
              key={task.id}
              className={`w-full rounded-md border p-4 text-left ${
                activeTask?.id === task.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface"
              }`}
              onClick={() => setActiveTask(task)}
            >
              <div className="text-sm font-medium">{task.name}</div>
              <div className="mt-2 text-xs text-secondary">
                {task.triggerType} / {task.format}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-6">
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{activeTask?.name ?? "发布配置"}</h1>
              <p className="mt-2 text-sm text-secondary">
                选择来源观点、目标平台与触发方式。
              </p>
            </div>
            {activeTask ? (
              <Button onClick={() => triggerTask(activeTask.id)}>手动触发</Button>
            ) : null}
          </div>
          <Textarea
            readOnly
            value={`目标数量：${targets.length}\n观点数量：${viewpoints.length}\n当前任务来源：${activeTask?.viewpointIds.join(", ") ?? "-"}`}
          />
        </Card>
        <Card className="space-y-4 p-6">
          <div className="text-sm font-medium">发布历史</div>
          <div className="space-y-3">
            {records.map((record) => (
              <div key={record.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>{record.status}</span>
                  <span className="text-secondary">{record.executedAt}</span>
                </div>
                {record.errorMsg ? (
                  <p className="mt-2 text-red-300">{record.errorMsg}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
