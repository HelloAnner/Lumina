"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  GripVertical,
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
  resolveViewpointDropIntent,
  type ViewpointDropTarget,
  type ViewpointTreeNode,
} from "@/components/knowledge/viewpoint-tree-utils"
import { cn } from "@/src/lib/utils"
import type { Viewpoint } from "@/src/server/store/types"
const AUTO_EXPAND_DELAY = 220
const AUTO_SCROLL_EDGE = 44
const AUTO_SCROLL_STEP = 14

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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const autoScrollDirectionRef = useRef<-1 | 0 | 1>(0)

  const tree = useMemo(() => buildViewpointTree(viewpoints), [viewpoints])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(String(event.active.id))
    setCtxMenu(null)
  }, [])

  const stopAutoScroll = useCallback(() => {
    autoScrollDirectionRef.current = 0
    if (autoScrollFrameRef.current) {
      cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
    }
  }, [])

  const startAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current) {
      return
    }
    const tick = () => {
      const container = scrollContainerRef.current
      const direction = autoScrollDirectionRef.current
      if (!container || direction === 0) {
        autoScrollFrameRef.current = null
        return
      }
      container.scrollTop += direction * AUTO_SCROLL_STEP
      autoScrollFrameRef.current = window.requestAnimationFrame(tick)
    }
    autoScrollFrameRef.current = window.requestAnimationFrame(tick)
  }, [])

  const updateAutoScroll = useCallback((clientY: number) => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }
    const rect = container.getBoundingClientRect()
    if (clientY < rect.top + AUTO_SCROLL_EDGE) {
      autoScrollDirectionRef.current = -1
      startAutoScroll()
      return
    }
    if (clientY > rect.bottom - AUTO_SCROLL_EDGE) {
      autoScrollDirectionRef.current = 1
      startAutoScroll()
      return
    }
    stopAutoScroll()
  }, [startAutoScroll, stopAutoScroll])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      stopAutoScroll()
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current)
        expandTimerRef.current = null
      }
      if (draggingId && dropTarget) {
        onReorder(dropTarget, draggingId)
      }
      setDraggingId(null)
      setDropTarget(null)
    },
    [draggingId, dropTarget, onReorder, stopAutoScroll]
  )

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll])

  const handleSetExpanded = useCallback(
    (id: string, val: boolean) => setExpanded((c) => ({ ...c, [id]: val })),
    []
  )
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  const handleQueueExpand = useCallback(
    (id: string) => {
      if (expandedRef.current[id]) return
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
      expandTimerRef.current = setTimeout(() => {
        setExpanded((current) => ({ ...current, [id]: true }))
        expandTimerRef.current = null
      }, AUTO_EXPAND_DELAY)
    },
    []
  )
  const handleClearQueuedExpand = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current)
      expandTimerRef.current = null
    }
  }, [])
  const handleContextMenu = useCallback(
    (nodeId: string, pos: { x: number; y: number }) => setCtxMenu({ nodeId, position: pos }),
    []
  )
  const handleRenameCancel = useCallback(() => setRenamingId(null), [])

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
        onDragCancel={() => {
          stopAutoScroll()
          if (expandTimerRef.current) {
            clearTimeout(expandTimerRef.current)
            expandTimerRef.current = null
          }
          setDraggingId(null)
          setDropTarget(null)
        }}
      >
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto py-1 px-1"
          onPointerMove={
            draggingId
              ? ((event) => updateAutoScroll(event.clientY))
              : undefined
          }
          onPointerLeave={draggingId ? stopAutoScroll : undefined}
        >
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
              onSetExpanded={handleSetExpanded}
              onQueueExpand={handleQueueExpand}
              onClearQueuedExpand={handleClearQueuedExpand}
              onSetDropTarget={setDropTarget}
              onTrackPointer={updateAutoScroll}
              onContextMenu={handleContextMenu}
              onRenameChange={setRenameTitle}
              onRenameConfirm={confirmRename}
              onRenameCancel={handleRenameCancel}
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
              onTrackPointer={updateAutoScroll}
              onDrop={() => {
                if (draggingId) {
                  onReorder({ type: "root" }, draggingId)
                  stopAutoScroll()
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
const TreeNodeItem = memo(function TreeNodeItem({
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
  onQueueExpand,
  onClearQueuedExpand,
  onSetDropTarget,
  onTrackPointer,
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
  onQueueExpand: (id: string) => void
  onClearQueuedExpand: () => void
  onSetDropTarget: (t: ViewpointDropTarget | null) => void
  onTrackPointer: (clientY: number) => void
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

  /** 默认更容易排序；只有明显向右拖入时才判定为子项 */
  const handleDragOver = useCallback(
    (e: React.DragEvent | React.PointerEvent | MouseEvent) => {
      if (!nodeRef.current || !draggingId) {
        return
      }
      const rect = nodeRef.current.getBoundingClientRect()
      const y = ("clientY" in e ? e.clientY : 0) - rect.top
      const x = ("clientX" in e ? e.clientX : 0) - rect.left
      const intent = resolveViewpointDropIntent({
        relativeX: x,
        relativeY: y,
        height: rect.height,
        indentLeft
      })
      if (intent === "before") {
        onClearQueuedExpand()
        onSetDropTarget({ type: "before", targetId: node.id })
      } else if (intent === "after") {
        onClearQueuedExpand()
        onSetDropTarget({ type: "after", targetId: node.id })
      } else {
        onQueueExpand(node.id)
        onSetDropTarget({ type: "inside", targetId: node.id })
      }
    },
    [draggingId, indentLeft, node.id, onClearQueuedExpand, onQueueExpand, onSetDropTarget]
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
      onPointerMove={
        draggingId
          ? ((event: React.PointerEvent<HTMLDivElement>) => {
              onTrackPointer(event.clientY)
              handleDragOver(event)
            }) as unknown as React.PointerEventHandler
          : undefined
      }
      onPointerLeave={
        draggingId
          ? () => {
              onClearQueuedExpand()
            }
          : undefined
      }
    >
      {/* 上方 drop 指示线 */}
      {isDropBefore && (
        <DropIndicator
          align="top"
          label="排到上方"
          offset={indentLeft}
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
        role="button"
        tabIndex={0}
        className={cn(
          "group viewpoint-tree-item relative flex w-full items-start gap-1.5 rounded-lg py-[7px] pr-2 text-left text-[13px] transition-colors",
          active
            ? "bg-overlay/80 text-foreground before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:rounded-full before:bg-primary/80 before:content-['']"
            : isDropInside
              ? "bg-primary/8 text-foreground ring-1 ring-primary/20 viewpoint-tree-item--inside"
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
            className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted transition-colors hover:text-foreground"
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
          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted/40">
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
            className="min-w-0 flex-1 break-words py-0.5 leading-[1.35] whitespace-normal"
            onDoubleClick={(e) => {
              e.stopPropagation()
              onRenameChange(node.title)
            }}
            title={node.title}
          >
            {node.title}
          </span>
        )}

        {/* 高亮数 */}
        {node.highlightCount > 0 && (
          <span className="mt-0.5 shrink-0 rounded px-1 text-[10px] tabular-nums text-muted/50">
            {node.highlightCount}
          </span>
        )}

        {isDropInside ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            子主题
          </span>
        ) : null}

        <button
          {...attributes}
          {...listeners}
          className={cn(
            "mt-0.5 inline-flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-muted/35 opacity-0 transition-all hover:bg-overlay/80 hover:text-foreground group-hover:opacity-100",
            isDragging && "cursor-grabbing opacity-100",
            isDropInside && "opacity-100 text-primary/80"
          )}
          onClick={(e) => e.stopPropagation()}
          title="拖动排序"
        >
          <GripVertical className="h-3 w-3" />
        </button>

        {/* hover 时的 + 按钮 */}
        <span
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted/40 opacity-0 transition-all hover:bg-overlay/80 hover:text-foreground group-hover:opacity-100"
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
              onQueueExpand={onQueueExpand}
              onClearQueuedExpand={onClearQueuedExpand}
              onSetDropTarget={onSetDropTarget}
              onTrackPointer={onTrackPointer}
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
        <DropIndicator
          align="bottom"
          label="排到下方"
          offset={indentLeft}
        />
      )}
    </div>
  )
})

/** 根级 drop zone */
function RootDropZone({
  active,
  onSetDropTarget,
  onTrackPointer,
  onDrop,
}: {
  active: boolean
  onSetDropTarget: (t: ViewpointDropTarget | null) => void
  onTrackPointer: (clientY: number) => void
  onDrop: () => void
}) {
  const { setNodeRef } = useDroppable({ id: "drop-root" })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-2 mt-2 rounded-lg border border-dashed p-3 text-center transition-colors",
        active
          ? "border-primary/50 bg-primary/10"
          : "border-border/30 bg-transparent"
      )}
      onPointerMove={(event: React.PointerEvent<HTMLDivElement>) => {
        onTrackPointer(event.clientY)
        onSetDropTarget({ type: "root" })
      }}
      onPointerUp={onDrop}
    >
      <p className={cn("text-[11px]", active ? "text-primary" : "text-muted")}>
        {active ? "松手，移回根目录" : "拖到这里放到根目录"}
      </p>
    </div>
  )
}

function DropIndicator({
  align,
  label,
  offset
}: {
  align: "top" | "bottom"
  label: string
  offset: number
}) {
  return (
    <div
      className={cn(
        "absolute left-0 right-0 z-10",
        align === "top" ? "top-0" : "bottom-0"
      )}
      style={{ marginLeft: offset }}
    >
      <div className="flex items-center gap-2">
        <div className="h-[3px] flex-1 rounded-full bg-primary/70" />
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          {label}
        </span>
      </div>
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
