/**
 * 搜寻主页面
 * 双 Tab 切换：审批台 / 任务管理
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useState } from "react"
import { ClipboardCheck, ListTodo, Radar } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { ReviewPanel } from "@/components/scout/review-panel"
import { TaskManager } from "@/components/scout/task-manager"
import type {
  ScoutTask,
  ScoutPatch,
  ScoutSource,
  Viewpoint
} from "@/src/server/store/types"

type Tab = "review" | "tasks"

interface Props {
  initialTasks: ScoutTask[]
  initialPatches: ScoutPatch[]
  initialSources: ScoutSource[]
  initialViewpoints: Viewpoint[]
}

export function ScoutClient({
  initialTasks,
  initialPatches,
  initialSources,
  initialViewpoints
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("review")
  const [tasks, setTasks] = useState(initialTasks)
  const [patches, setPatches] = useState(initialPatches)

  const pendingCount = patches.filter((p) => p.status === "pending").length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 头部 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-muted" />
          <h1 className="text-[15px] font-medium text-foreground">搜寻</h1>
        </div>
        <div className="flex items-center rounded-lg border border-border bg-overlay/30 p-0.5">
          <TabButton
            active={activeTab === "review"}
            onClick={() => setActiveTab("review")}
            icon={ClipboardCheck}
            label="审批台"
            badge={pendingCount}
          />
          <TabButton
            active={activeTab === "tasks"}
            onClick={() => setActiveTab("tasks")}
            icon={ListTodo}
            label="任务管理"
          />
        </div>
      </header>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "review" ? (
          <ReviewPanel
            tasks={tasks}
            patches={patches}
            onPatchesChange={setPatches}
          />
        ) : (
          <TaskManager
            tasks={tasks}
            sources={initialSources}
            viewpoints={initialViewpoints}
            onTasksChange={setTasks}
          />
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-medium text-primary">
          {badge}
        </span>
      )}
    </button>
  )
}
