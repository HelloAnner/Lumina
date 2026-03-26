/**
 * 笔记目录切换按钮
 *
 * @author Anner
 * @since 0.4.0
 * Created on 2026/3/26
 */
import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/src/lib/utils"

interface NoteOutlineToggleProps {
  collapsed: boolean
  onToggle: () => void
  className?: string
}

/**
 * 目录开关只保留图标，通过 title 与 aria-label 保留语义
 */
export function NoteOutlineToggle({
  collapsed,
  onToggle,
  className
}: NoteOutlineToggleProps) {
  const title = collapsed ? "展开目录" : "收起目录"
  const Icon = collapsed ? ChevronRight : ChevronLeft

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={title}
      title={title}
      className={cn("note-outline-toggle", className)}
      onClick={onToggle}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  )
}
