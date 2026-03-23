"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronRight, FolderPlus, FilePlus, Mail, Eye, Edit3 } from "lucide-react"
import { marked } from "marked"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/src/lib/utils"
import type { Highlight, Viewpoint } from "@/src/server/store/types"

interface TreeNode extends Viewpoint {
  children: TreeNode[]
}

type DraftNode = {
  parentId?: string
  isFolder: boolean
  placement: "root" | "child"
}

interface CursorPosition {
  top: number
  left: number
}

function buildTree(nodes: Viewpoint[]) {
  const map = new Map<string, TreeNode>()
  nodes.forEach((node) => map.set(node.id, { ...node, children: [] }))
  const roots: TreeNode[] = []
  nodes.forEach((node) => {
    const current = map.get(node.id)!
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(current)
    } else {
      roots.push(current)
    }
  })
  const sortNodes = (items: TreeNode[]) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder)
    items.forEach((item) => sortNodes(item.children))
  }
  sortNodes(roots)
  return roots
}

export function KnowledgeClient({
  initialViewpoints,
  initialSelected,
  unconfirmed,
  initialWidths
}: {
  initialViewpoints: Viewpoint[]
  initialSelected?: Viewpoint
  unconfirmed: (Highlight & { similarityScore?: number })[]
  initialWidths: {
    knowledgeTreeWidth: number
    knowledgeListWidth: number
  }
}) {
  const [viewpoints, setViewpoints] = useState(initialViewpoints)
  const [selectedId, setSelectedId] = useState(initialSelected?.id ?? initialViewpoints[0]?.id)
  const [article, setArticle] = useState(initialSelected?.articleContent ?? "")
  const [treeWidth, setTreeWidth] = useState(initialWidths.knowledgeTreeWidth)
  const [listWidth, setListWidth] = useState(initialWidths.knowledgeListWidth)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialViewpoints.map((item) => [item.id, true]))
  )
  const [draftNode, setDraftNode] = useState<DraftNode | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null)
  const [currentLine, setCurrentLine] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 抽取可调整大小面板的拖拽逻辑
  const createResizeHandler = useCallback(
    (initialWidth: number, onResize: (width: number) => void) => {
      return (event: React.MouseEvent) => {
        const startX = event.clientX
        const initial = initialWidth
        const move = (moveEvent: MouseEvent) =>
          onResize(Math.min(420, Math.max(180, initial + moveEvent.clientX - startX)))
        const up = () => {
          window.removeEventListener("mousemove", move)
          window.removeEventListener("mouseup", up)
        }
        window.addEventListener("mousemove", move)
        window.addEventListener("mouseup", up)
      }
    },
    []
  )

  // 追踪光标位置并提取当前行
  const updateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const { selectionStart, value } = textarea
    // 提取当前行
    const beforeCursor = value.slice(0, selectionStart)
    const lines = beforeCursor.split("\n")
    const currentLineText = lines[lines.length - 1] || ""
    setCurrentLine(currentLineText)

    // 使用更精确的方法获取光标位置
    const textLines = value.slice(0, selectionStart).split("\n")
    const lineHeight = 28 // 约等于 text-sm leading-7
    const charWidth = 8.4 // 约等于 monospace 字体的字符宽度

    const top = textLines.length * lineHeight + 16 // 16px padding
    const left = currentLineText.length * charWidth + 16

    setCursorPosition({ top, left })
  }, [])

  // 防抖更新光标位置
  const debouncedUpdateCursor = useCallback(() => {
    requestAnimationFrame(() => {
      updateCursorPosition()
    })
  }, [updateCursorPosition])

  const selected = viewpoints.find((item) => item.id === selectedId)
  const tree = useMemo(() => buildTree(viewpoints), [viewpoints])
  const previewHtml = useMemo(() => marked.parse(article), [article])
  const inlinePreviewHtml = useMemo(() => {
    if (!currentLine.trim()) return ""
    return marked.parse(currentLine)
  }, [currentLine])

  useEffect(() => {
    if (!selected) {
      return
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
    }
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/viewpoints/${selected.id}/article`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleContent: article })
      })
    }, 900)
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
    }
  }, [article, selected])

  useEffect(() => {
    if (prefTimer.current) {
      clearTimeout(prefTimer.current)
    }
    prefTimer.current = setTimeout(async () => {
      await fetch("/api/preferences/ui", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          knowledgeTreeWidth: Math.round(treeWidth),
          knowledgeListWidth: Math.round(listWidth)
        })
      })
    }, 180)
    return () => {
      if (prefTimer.current) {
        clearTimeout(prefTimer.current)
      }
    }
  }, [treeWidth, listWidth])

  async function submitDraft() {
    if (!draftNode || !draftTitle.trim()) {
      setDraftNode(null)
      setDraftTitle("")
      return
    }
    const response = await fetch("/api/viewpoints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: draftTitle.trim(),
        parentId: draftNode.parentId,
        isFolder: draftNode.isFolder
      })
    })
    const data = await response.json()
    if (response.ok) {
      setViewpoints((current) => [...current, data.item])
      if (draftNode.parentId) {
        setExpanded((current) => ({ ...current, [draftNode.parentId!]: true }))
      }
      if (!data.item.isFolder) {
        setSelectedId(data.item.id)
        setArticle(data.item.articleContent)
      }
    }
    setDraftNode(null)
    setDraftTitle("")
  }

  function openRootDraft(isFolder: boolean) {
    setDraftNode({
      isFolder,
      placement: "root"
    })
    setDraftTitle("")
  }

  function openDraft(parentId: string | undefined, isFolder: boolean) {
    setDraftNode({
      parentId,
      isFolder,
      placement: parentId ? "child" : "root"
    })
    setDraftTitle("")
    if (parentId) {
      setExpanded((current) => ({ ...current, [parentId]: true }))
    }
  }

  function renderDraft(depth: number) {
    if (!draftNode) {
      return null
    }
    return (
      <div className="px-2 py-1" style={{ paddingLeft: 12 + depth * 14 }}>
        <input
          autoFocus
          className="h-9 w-full rounded-md border border-primary/30 bg-elevated px-3 text-sm text-foreground outline-none focus:border-primary"
          placeholder={draftNode.isFolder ? "输入分组名称" : "输入观点名称"}
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={submitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submitDraft()
            }
            if (event.key === "Escape") {
              setDraftNode(null)
              setDraftTitle("")
            }
          }}
        />
      </div>
    )
  }

  function renderNode(node: TreeNode, depth = 0): React.ReactNode {
    const isExpanded = expanded[node.id] ?? true
    const active = selectedId === node.id
    const hasChildren = node.children.length > 0
    const showDraftHere = draftNode?.parentId === node.id && draftNode.placement === "child"
    return (
      <div key={node.id}>
        <button
          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
            active ? "bg-elevated text-foreground" : "text-secondary hover:bg-overlay hover:text-foreground"
          }`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => {
            setSelectedId(node.id)
            setArticle(node.articleContent)
          }}
        >
          {hasChildren ? (
            <span
              className="inline-flex h-4 w-4 items-center justify-center"
              onClick={(event) => {
                event.stopPropagation()
                setExpanded((current) => ({ ...current, [node.id]: !isExpanded }))
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
          ) : (
            <span className="inline-block h-4 w-4" />
          )}
          <span className="truncate">{node.title}</span>
          {!node.isFolder ? <span className="ml-auto text-xs">{node.highlightCount}</span> : null}
        </button>
        {showDraftHere ? renderDraft(depth + 1) : null}
        {hasChildren && isExpanded ? node.children.map((child) => renderNode(child, depth + 1)) : null}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-base">
      <aside className="relative border-r border-border bg-reader-sidebar" style={{ width: treeWidth }}>
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-sm font-medium">观点树</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => openRootDraft(true)} title="新建顶层分组">
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => openRootDraft(false)} title="新建顶层观点">
              <FilePlus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1 px-2 py-2">
          {draftNode?.placement === "root" ? renderDraft(0) : null}
          {tree.map((node) => renderNode(node))}
        </div>
        <div
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
          onMouseDown={createResizeHandler(treeWidth, setTreeWidth)}
        />
      </aside>

      <aside className="relative border-r border-border" style={{ width: listWidth }}>
        <div className="border-b border-border px-4 py-4">
          <div className="text-sm font-medium">{selected?.title ?? "未选择观点"}</div>
          <div className="mt-1 text-xs text-secondary">Markdown 即时渲染</div>
        </div>
        <div className="space-y-4 p-4">
          <Card className="p-4">
            <div className="text-xs text-secondary">待确认弱关联</div>
            <div className="mt-3 space-y-3">
              {unconfirmed.length === 0 ? (
                <div className="text-xs text-muted">暂无待确认划线</div>
              ) : (
                unconfirmed.map((item) => (
                  <div key={item.id} className="rounded-md border border-border p-3">
                    <p className="text-sm text-foreground">{item.content}</p>
                    <div className="mt-2 text-xs text-secondary">
                      相似度 {(item.similarityScore ?? 0).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
        <div
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
          onMouseDown={createResizeHandler(listWidth, setListWidth)}
        />
      </aside>

      <main className="min-w-0 flex-1">
        <div className="flex h-14 items-center justify-between border-b border-border px-8">
          <div className="text-lg font-semibold">{selected?.title ?? "知识文章"}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={cn(isPreviewMode && "bg-elevated")}
            >
              {isPreviewMode ? (
                <>
                  <Edit3 className="mr-2 h-4 w-4" />
                  编辑
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  预览
                </>
              )}
            </Button>
            <Button variant="ghost">
              <Mail className="mr-2 h-4 w-4" />
              发送邮件
            </Button>
          </div>
        </div>
        <div className="relative h-[calc(100vh-56px)] overflow-hidden">
          {isPreviewMode ? (
            <div className="h-full overflow-y-auto p-6">
              <div
                className="prose-lumina max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
              <div className="mt-8 flex flex-wrap gap-2">
                {selected?.relatedBookIds.map((item) => (
                  <Badge key={item}>{item.slice(0, 8)}</Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative h-full p-6">
              <div className="absolute inset-0 overflow-y-auto">
                <div className="relative min-h-full font-mono text-sm leading-7">
                  {/* 即时行内预览层 */}
                  <div
                    ref={previewRef}
                    className="pointer-events-none absolute text-transparent"
                    aria-hidden="true"
                  >
                    <span>{article.slice(0, 0)}</span>
                    {/* 占位符保持行高 */}
                  </div>

                  {/* 编辑区域 */}
                  <textarea
                    ref={textareaRef}
                    className="absolute inset-0 h-full w-full resize-none border-none bg-transparent px-0 py-0 font-mono text-sm leading-7 text-transparent caret-foreground"
                    value={article}
                    onChange={(event) => setArticle(event.target.value)}
                    onSelect={debouncedUpdateCursor}
                    onKeyUp={debouncedUpdateCursor}
                    onClick={debouncedUpdateCursor}
                    spellCheck={false}
                  />

                  {/* 渲染层（显示背景 Markdown 效果） */}
                  <div
                    className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap font-mono text-sm leading-7 text-muted/30"
                    aria-hidden="true"
                  >
                    {article.split("\n").map((line, idx) => (
                      <div
                        key={idx}
                        className="min-h-[28px]"
                        dangerouslySetInnerHTML={{
                          __html: marked.parse(line || " ") as string
                        }}
                      />
                    ))}
                  </div>

                  {/* 即时行预览浮动层 - 在光标位置显示当前行的 Markdown 渲染 */}
                  {cursorPosition && currentLine.trim() && (
                    <div
                      className="pointer-events-none absolute z-10 rounded-md border border-border/50 bg-elevated/95 p-2 shadow-lg backdrop-blur-sm"
                      style={{
                        top: `${cursorPosition.top + 24}px`,
                        left: `${cursorPosition.left}px`,
                        maxWidth: "400px"
                      }}
                    >
                      <div
                        className="prose-lumina prose-lumina-sm max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: inlinePreviewHtml }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
