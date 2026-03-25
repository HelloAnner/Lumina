"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FilePlus,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  ArrowUpToLine,
} from "lucide-react"
import {
  ContextMenu,
  type ContextMenuEntry,
} from "@/components/ui/context-menu"
import {
  buildViewpointTree,
  type ViewpointDropTarget,
  type ViewpointTreeNode,
} from "@/components/knowledge/viewpoint-tree-utils"
import { cn } from "@/src/lib/utils"
import type { Viewpoint } from "@/src/server/store/types"

/**
 * 主题树组件
 * 支持拖拽排序、右键菜单、inline 新建/重命名
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */

interface ViewpointTreeProps {
  viewpoints: Viewpoint[]
  selectedId?: string
  onSelect: (id: string) => void
  onReorder: (target: ViewpointDropTarget, sourceId: string) => void
  onCreate: (parentId?: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  /** 当前 inline 创建状态 */
  draftParentId?: string | null
  draftTitle?: string
  onDraftTitleChange?: (title: string) => void
  onDraftSubmit?: () => void
  onDraftCancel?: () => void
  /** 导入笔记插槽 */
  importedNotesSlot?: React.ReactNode
}

export function ViewpointTree({
  viewpoints,
  selectedId,
  onSelect,
  onReorder,
  onCreate,
  onRename,
  onDelete,
  draftParentId,
  draftTitle = "",
  onDraftTitleChange,
  onDraftSubmit,
  onDraftCancel,
  importedNotesSlot,
}: ViewpointTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(viewpoints.map((v) => [v.id, true]))
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<ViewpointDropTarget | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [ctxMenu, setCtxMenu] = useState<{
    nodeId: string
    position: { x: number; y: number }
  } | null>(null)

  const tree = useMemo(() => buildViewpointTree(viewpoints), [viewpoints])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(String(event.active.id))
    setCtxMenu(null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (draggingId && dropTarget) {
        onReorder(dropTarget, draggingId)
      }
      setDraggingId(null)
      setDropTarget(null)
    },
    [draggingId, dropTarget, onReorder]
  )

  /** 键盘快捷键 */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2" && selectedId && !renamingId) {
        e.preventDefault()
        const vp = viewpoints.find((v) => v.id === selectedId)
        if (vp) {
          setRenamingId(selectedId)
          setRenameTitle(vp.title)
        }
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [selectedId, renamingId, viewpoints])

  const confirmRename = useCallback(
    (id: string) => {
      const trimmed = renameTitle.trim()
      if (trimmed) {
        onRename(id, trimmed)
      }
      setRenamingId(null)
    },
    [onRename, renameTitle]
  )

  /** 构建右键菜单项 */
  const buildContextItems = useCallback(
    (node: ViewpointTreeNode): ContextMenuEntry[] => {
      const items: ContextMenuEntry[] = [
        {
          label: "重命名",
          icon: <Pencil className="h-3.5 w-3.5" />,
          shortcut: "F2",
          onClick: () => {
            setRenamingId(node.id)
            setRenameTitle(node.title)
          },
        },
        {
          label: "新建子主题",
          icon: <FilePlus className="h-3.5 w-3.5" />,
          onClick: () => onCreate(node.id),
        },
      ]
      if (node.parentId) {
        items.push({ type: "divider" })
        items.push({
          label: "移到根目录",
          icon: <ArrowUpToLine className="h-3.5 w-3.5" />,
          onClick: () => onReorder({ type: "root" }, node.id),
        })
      }
      items.push({ type: "divider" })
      items.push({
        label: "删除",
        icon: <Trash2 className="h-3.5 w-3.5" />,
        destructive: true,
        onClick: () => onDelete(node.id),
      })
      return items
    },
    [onCreate, onDelete, onReorder]
  )

  const draggingNode = draggingId
    ? findNode(tree, draggingId)
    : null

  return (
    <>
      <div className="flex h-11 items-center justify-between px-3 border-b border-border/40">
        <span className="text-[11px] font-medium uppercase tracking-widest text-secondary">
          主题树
        </span>
        <button
          onClick={() => onCreate(undefined)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-overlay/60 hover:text-foreground"
          title="新建根主题"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-y-auto py-1 px-1">
          {/* 全部主题 */}
          <button
            className={cn(
              "flex w-full items-center gap-1.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] transition-colors",
              !selectedId
                ? "text-foreground bg-overlay/60"
                : "text-muted hover:bg-overlay/40 hover:text-secondary"
            )}
            onClick={() => onSelect("")}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted/60" />
            <span className="truncate">全部主题</span>
          </button>

          {/* 根级 draft */}
          {draftParentId === undefined && draftParentId !== null
            ? null
            : draftParentId === null
              ? renderDraft(0)
              : null}

          {tree.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              draggingId={draggingId}
              dropTarget={dropTarget}
              renamingId={renamingId}
              renameTitle={renameTitle}
              expanded={expanded}
              draftParentId={draftParentId ?? undefined}
              draftTitle={draftTitle}
              onSelect={onSelect}
              onSetExpanded={(id, val) =>
                setExpanded((c) => ({ ...c, [id]: val }))
              }
              onSetDropTarget={setDropTarget}
              onContextMenu={(nodeId, pos) =>
                setCtxMenu({ nodeId, position: pos })
              }
              onRenameChange={setRenameTitle}
              onRenameConfirm={confirmRename}
              onRenameCancel={() => setRenamingId(null)}
              onCreateChild={onCreate}
              onDraftTitleChange={onDraftTitleChange}
              onDraftSubmit={onDraftSubmit}
              onDraftCancel={onDraftCancel}
            />
          ))}

          {/* 拖到根目录 drop zone */}
          {draggingId && (
            <RootDropZone
              active={dropTarget?.type === "root"}
              onSetDropTarget={setDropTarget}
              onDrop={() => {
                if (draggingId) {
                  onReorder({ type: "root" }, draggingId)
                  setDraggingId(null)
                  setDropTarget(null)
                }
              }}
            />
          )}

          {importedNotesSlot}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingNode ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-elevated px-2.5 py-[7px] text-[13px] text-foreground shadow-lg shadow-black/20">
              <FileText className="h-3.5 w-3.5 text-muted" />
              <span className="truncate">{draggingNode.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {ctxMenu && (
        <ContextMenu
          items={buildContextItems(
            findNode(tree, ctxMenu.nodeId)!
          )}
          position={ctxMenu.position}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )

  function renderDraft(depth: number) {
    return (
      <div className="py-0.5" style={{ paddingLeft: 8 + depth * 16 }}>
        <input
          autoFocus
          className="h-7 w-full rounded-md border border-primary/30 bg-elevated px-2 text-[13px] text-foreground outline-none transition-shadow focus:border-primary/50 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.1)]"
          placeholder="输入主题名称"
          value={draftTitle}
          onChange={(e) => onDraftTitleChange?.(e.target.value)}
          onBlur={() => onDraftSubmit?.()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onDraftSubmit?.()
            }
            if (e.key === "Escape") {
              onDraftCancel?.()
            }
          }}
        />
      </div>
    )
  }
}

// ---- 子组件 ----

/** 单个树节点 */
function TreeNodeItem({
  node,
  depth,
  selectedId,
  draggingId,
  dropTarget,
  renamingId,
  renameTitle,
  expanded,
  draftParentId,
  draftTitle,
  onSelect,
  onSetExpanded,
  onSetDropTarget,
  onContextMenu,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  onCreateChild,
  onDraftTitleChange,
  onDraftSubmit,
  onDraftCancel,
}: {
  node: ViewpointTreeNode
  depth: number
  selectedId?: string
  draggingId: string | null
  dropTarget: ViewpointDropTarget | null
  renamingId: string | null
  renameTitle: string
  expanded: Record<string, boolean>
  draftParentId?: string
  draftTitle: string
  onSelect: (id: string) => void
  onSetExpanded: (id: string, val: boolean) => void
  onSetDropTarget: (t: ViewpointDropTarget | null) => void
  onContextMenu: (nodeId: string, pos: { x: number; y: number }) => void
  onRenameChange: (title: string) => void
  onRenameConfirm: (id: string) => void
  onRenameCancel: () => void
  onCreateChild: (parentId?: string) => void
  onDraftTitleChange?: (title: string) => void
  onDraftSubmit?: () => void
  onDraftCancel?: () => void
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const isExpanded = expanded[node.id] ?? true
  const active = selectedId === node.id
  const hasChildren = node.children.length > 0
  const isDragging = draggingId === node.id
  const showDraft = draftParentId === node.id
  const indentLeft = 8 + depth * 16

  const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({
    id: node.id,
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${node.id}`,
    data: { nodeId: node.id },
  })

  /** 计算 drop 位置：上25% = before, 中50% = inside, 下25% = after */
  const handleDragOver = useCallback(
    (e: React.DragEvent | React.PointerEvent | MouseEvent) => {
      if (!nodeRef.current || !draggingId) {
        return
      }
      const rect = nodeRef.current.getBoundingClientRect()
      const y = ("clientY" in e ? e.clientY : 0) - rect.top
      const ratio = y / rect.height
      if (ratio < 0.25) {
        onSetDropTarget({ type: "before", targetId: node.id })
      } else if (ratio > 0.75) {
        onSetDropTarget({ type: "after", targetId: node.id })
      } else {
        onSetDropTarget({ type: "inside", targetId: node.id })
      }
    },
    [draggingId, node.id, onSetDropTarget]
  )

  // 判断当前是否是 drop target
  const isDropBefore =
    dropTarget?.type === "before" &&
    "targetId" in dropTarget &&
    dropTarget.targetId === node.id
  const isDropAfter =
    dropTarget?.type === "after" &&
    "targetId" in dropTarget &&
    dropTarget.targetId === node.id
  const isDropInside =
    dropTarget?.type === "inside" &&
    "targetId" in dropTarget &&
    dropTarget.targetId === node.id

  return (
    <div
      ref={(el) => {
        nodeRef.current = el
        setDropRef(el)
      }}
      className="relative"
      onPointerMove={draggingId ? handleDragOver as unknown as React.PointerEventHandler : undefined}
    >
      {/* 上方 drop 指示线 */}
      {isDropBefore && (
        <div
          className="absolute left-0 right-0 top-0 z-10 h-[3px] rounded-full bg-primary/70"
          style={{ marginLeft: indentLeft }}
        />
      )}

      {/* 层级引导线 */}
      {depth > 0 && (
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/20"
          style={{ left: indentLeft - 8 }}
        />
      )}

      <div
        ref={setDragRef}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        className={cn(
          "group relative flex w-full items-center gap-1.5 rounded-lg py-[7px] pr-2 text-left text-[13px] transition-colors",
          active
            ? "bg-overlay/80 text-foreground before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:rounded-full before:bg-primary/80 before:content-['']"
            : isDropInside
              ? "bg-primary/8 text-foreground ring-1 ring-primary/20"
              : "text-secondary hover:bg-overlay/50 hover:text-foreground",
          isDragging && "opacity-30"
        )}
        style={{ paddingLeft: indentLeft }}
        onClick={() => onSelect(node.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu(node.id, { x: e.clientX, y: e.clientY })
        }}
      >
        {/* 展开/折叠 或 文件图标 */}
        {hasChildren ? (
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted transition-colors hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              onSetExpanded(node.id, !isExpanded)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted/40">
            <FileText className="h-3.5 w-3.5" />
          </span>
        )}

        {/* 标题 / 重命名输入 */}
        {renamingId === node.id ? (
          <input
            autoFocus
            className="min-w-0 flex-1 rounded-md bg-elevated/80 px-1.5 py-0.5 text-[13px] text-foreground outline-none ring-1 ring-primary/30 transition-shadow focus:ring-primary/50"
            value={renameTitle}
            onChange={(e) => onRenameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            onBlur={() => onRenameConfirm(node.id)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === "Enter") {
                onRenameConfirm(node.id)
              }
              if (e.key === "Escape") {
                onRenameCancel()
              }
            }}
          />
        ) : (
          <span
            className="min-w-0 flex-1 truncate"
            onDoubleClick={(e) => {
              e.stopPropagation()
              onRenameChange(node.title)
            }}
          >
            {node.title}
          </span>
        )}

        {/* 高亮数 */}
        {node.highlightCount > 0 && (
          <span className="shrink-0 rounded px-1 text-[10px] tabular-nums text-muted/50">
            {node.highlightCount}
          </span>
        )}

        {/* hover 时的 + 按钮 */}
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted/40 opacity-0 transition-all hover:bg-overlay/80 hover:text-foreground group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onCreateChild(node.id)
          }}
        >
          <Plus className="h-3 w-3" />
        </span>
      </div>

      {/* 子级 draft */}
      {showDraft && (
        <div className="py-0.5" style={{ paddingLeft: 8 + (depth + 1) * 16 }}>
          <input
            autoFocus
            className="h-7 w-full rounded-md border border-primary/30 bg-elevated px-2 text-[13px] text-foreground outline-none transition-shadow focus:border-primary/50 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.1)]"
            placeholder="输入主题名称"
            value={draftTitle}
            onChange={(e) => onDraftTitleChange?.(e.target.value)}
            onBlur={() => onDraftSubmit?.()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onDraftSubmit?.()
              }
              if (e.key === "Escape") {
                onDraftCancel?.()
              }
            }}
          />
        </div>
      )}

      {/* 子节点 */}
      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              draggingId={draggingId}
              dropTarget={dropTarget}
              renamingId={renamingId}
              renameTitle={renameTitle}
              expanded={expanded}
              draftParentId={draftParentId}
              draftTitle={draftTitle}
              onSelect={onSelect}
              onSetExpanded={onSetExpanded}
              onSetDropTarget={onSetDropTarget}
              onContextMenu={onContextMenu}
              onRenameChange={onRenameChange}
              onRenameConfirm={onRenameConfirm}
              onRenameCancel={onRenameCancel}
              onCreateChild={onCreateChild}
              onDraftTitleChange={onDraftTitleChange}
              onDraftSubmit={onDraftSubmit}
              onDraftCancel={onDraftCancel}
            />
          ))
        : null}

      {/* 下方 drop 指示线 */}
      {isDropAfter && (
        <div
          className="absolute left-0 right-0 bottom-0 z-10 h-[3px] rounded-full bg-primary/70"
          style={{ marginLeft: indentLeft }}
        />
      )}
    </div>
  )
}

/** 根级 drop zone */
function RootDropZone({
  active,
  onSetDropTarget,
  onDrop,
}: {
  active: boolean
  onSetDropTarget: (t: ViewpointDropTarget | null) => void
  onDrop: () => void
}) {
  const { setNodeRef } = useDroppable({ id: "drop-root" })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-2 mt-2 rounded-lg border border-dashed p-3 text-center transition-colors",
        active
          ? "border-primary/40 bg-primary/5"
          : "border-border/30 bg-transparent"
      )}
      onPointerMove={() => onSetDropTarget({ type: "root" })}
      onPointerUp={onDrop}
    >
      <p className="text-[11px] text-muted">拖到这里放到根目录</p>
    </div>
  )
}

// ---- 工具函数 ----

function findNode(
  nodes: ViewpointTreeNode[],
  id: string
): ViewpointTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    const child = findNode(node.children, id)
    if (child) {
      return child
    }
  }
  return null
}
