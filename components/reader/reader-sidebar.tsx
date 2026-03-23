/**
 * 阅读器目录侧栏
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import type React from "react"
import { memo } from "react"
import { ListTree } from "lucide-react"
import type { SidebarNode } from "@/components/reader/reader-types"

const SidebarTreeNode = memo(function SidebarTreeNode({
  node,
  depth,
  activeIndex,
  onNavigate,
  itemRefs
}: {
  node: SidebarNode
  depth: number
  activeIndex: number
  onNavigate: (index: number) => void
  itemRefs: React.MutableRefObject<Record<number, HTMLButtonElement | null>>
}) {
  const active = node.sourceIndex === activeIndex
  return (
    <div>
      <button
        ref={(element) => {
          itemRefs.current[node.sourceIndex] = element
        }}
        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
          active
            ? "bg-elevated text-foreground ring-1 ring-primary/25"
            : "text-secondary hover:bg-overlay hover:text-foreground"
        }`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => onNavigate(node.sourceIndex)}
      >
        <span className={`truncate ${depth > 0 ? "text-[13px]" : ""}`}>
          {depth > 0 ? "· " : ""}
          {node.title}
        </span>
        <span className="ml-2 text-xs">{node.sourceIndex + 1}</span>
      </button>
      {node.children.length > 0 ? (
        <div className="ml-4 mt-1 space-y-1 border-l border-border/70 pl-2">
          {node.children.map((child) => (
            <SidebarTreeNode
              key={`${child.id}-${child.sourceIndex}`}
              node={child}
              depth={depth + 1}
              activeIndex={activeIndex}
              onNavigate={onNavigate}
              itemRefs={itemRefs}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
})

export function ReaderSidebar({
  width,
  nodes,
  activeIndex,
  onNavigate,
  onResizeStart,
  itemRefs
}: {
  width: number
  nodes: SidebarNode[]
  activeIndex: number
  onNavigate: (index: number) => void
  onResizeStart: (event: React.MouseEvent) => void
  itemRefs: React.MutableRefObject<Record<number, HTMLButtonElement | null>>
}) {
  return (
    <aside
      className="relative border-r border-border bg-reader-sidebar"
      style={{ width }}
    >
      <div className="flex h-12 items-center gap-2 border-b border-border px-4 text-sm font-medium">
        <ListTree className="h-4 w-4 text-primary" />
        目录
      </div>
      <div className="h-[calc(100%-48px)] overflow-y-auto p-2">
        <div className="space-y-1">
          {nodes.map((node) => (
            <SidebarTreeNode
              key={`${node.id}-${node.sourceIndex}`}
              node={node}
              depth={0}
              activeIndex={activeIndex}
              onNavigate={onNavigate}
              itemRefs={itemRefs}
            />
          ))}
        </div>
      </div>
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
        onMouseDown={onResizeStart}
      />
    </aside>
  )
}
