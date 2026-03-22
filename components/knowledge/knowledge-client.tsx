"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronRight, FolderPlus, FilePlus, Mail } from "lucide-react"
import { marked } from "marked"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Toast } from "@/components/ui/toast"
import type { Highlight, Viewpoint } from "@/src/server/store/types"

interface TreeNode extends Viewpoint {
  children: TreeNode[]
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
  return roots.sort((a, b) => a.sortOrder - b.sortOrder)
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
  const [toast, setToast] = useState("")
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  const prefTimer = useRef<NodeJS.Timeout | null>(null)
  const selected = viewpoints.find((item) => item.id === selectedId)
  const tree = useMemo(() => buildTree(viewpoints), [viewpoints])
  const previewHtml = useMemo(() => marked.parse(article), [article])

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
      setToast("内容已自动保存")
    }, 800)
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

  async function createViewpoint(parentId?: string, isFolder = false) {
    const title = window.prompt(isFolder ? "请输入分组名称" : "请输入观点名称")
    if (!title) {
      return
    }
    const response = await fetch("/api/viewpoints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, parentId, isFolder })
    })
    const data = await response.json()
    if (response.ok) {
      setViewpoints((current) => [...current, data.item])
      setExpanded((current) => ({ ...current, [parentId ?? data.item.id]: true }))
      setToast(isFolder ? "分组已创建" : "观点已创建")
    }
  }

  function renderNode(node: TreeNode, depth = 0): React.ReactNode {
    const isExpanded = expanded[node.id] ?? true
    const active = selectedId === node.id
    const hasChildren = node.children.length > 0
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
        {hasChildren && isExpanded ? node.children.map((child) => renderNode(child, depth + 1)) : null}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-base">
      {toast ? (
        <Toast title={toast} tone="success" onClose={() => setToast("")} />
      ) : null}

      <aside className="relative border-r border-border bg-[#0D0D0F]" style={{ width: treeWidth }}>
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-sm font-medium">观点树</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => createViewpoint(undefined, true)}>
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => createViewpoint(undefined, false)}>
              <FilePlus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1 px-2 py-2">{tree.map((node) => renderNode(node))}</div>
        <div
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
          onMouseDown={(event) => {
            const startX = event.clientX
            const initial = treeWidth
            const move = (moveEvent: MouseEvent) =>
              setTreeWidth(Math.min(420, Math.max(180, initial + moveEvent.clientX - startX)))
            const up = () => {
              window.removeEventListener("mousemove", move)
              window.removeEventListener("mouseup", up)
            }
            window.addEventListener("mousemove", move)
            window.addEventListener("mouseup", up)
          }}
        />
      </aside>

      <aside className="relative border-r border-border" style={{ width: listWidth }}>
        <div className="border-b border-border px-4 py-4">
          <div className="text-sm font-medium">{selected?.title ?? "未选择观点"}</div>
          <div className="mt-1 text-xs text-secondary">自动保存 / Markdown 即时渲染</div>
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
          <Button variant="secondary" onClick={() => selected && createViewpoint(selected.id, false)}>
            在当前节点下新建子观点
          </Button>
        </div>
        <div
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
          onMouseDown={(event) => {
            const startX = event.clientX
            const initial = listWidth
            const move = (moveEvent: MouseEvent) =>
              setListWidth(Math.min(420, Math.max(220, initial + moveEvent.clientX - startX)))
            const up = () => {
              window.removeEventListener("mousemove", move)
              window.removeEventListener("mouseup", up)
            }
            window.addEventListener("mousemove", move)
            window.addEventListener("mouseup", up)
          }}
        />
      </aside>

      <main className="min-w-0 flex-1">
        <div className="flex h-14 items-center justify-between border-b border-border px-8">
          <div className="text-lg font-semibold">{selected?.title ?? "知识文章"}</div>
          <div className="flex gap-2">
            <Button variant="ghost">
              <Mail className="mr-2 h-4 w-4" />
              发送邮件
            </Button>
          </div>
        </div>
        <div className="grid h-[calc(100vh-56px)] grid-cols-2 gap-0">
          <div className="border-r border-border p-6">
            <div className="mb-3 text-xs uppercase tracking-[0.24em] text-secondary">Markdown</div>
            <Textarea
              className="h-[calc(100vh-120px)] resize-none border-transparent bg-transparent px-0 py-0 font-mono text-sm leading-7"
              value={article}
              onChange={(event) => setArticle(event.target.value)}
            />
          </div>
          <div className="overflow-y-auto p-6">
            <div className="mb-3 text-xs uppercase tracking-[0.24em] text-secondary">Preview</div>
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
        </div>
      </main>
    </div>
  )
}
