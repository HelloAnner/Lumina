"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,

  Folder,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { cn } from "@/src/lib/utils"
import { ArticleLinkImportDialog } from "@/components/articles/article-link-import-dialog"
import { formatArticlePublishedAtSummary } from "@/components/articles/article-published-at"
import { SourceFolderIcon } from "@/components/articles/source-folder-icons"
import type { ScoutArticle } from "@/src/server/store/types"

export interface ArticleSourceFolder {
  sourceId: string
  kind: "source" | "manual"
  name: string
  endpoint: string
  protocol: string
  status: string
  articleCount: number
  lastFetchedAt?: string
  lastArticleAt?: string
}

type SortField = "time" | "title"
type SortDir = "asc" | "desc"
type StatusFilter = "all" | "unread" | "reading" | "favorite"

interface Props {
  initialFolders: ArticleSourceFolder[]
  initialArticles: ScoutArticle[]
  initialSourceId?: string | null
}

export function ArticlesClient({
  initialFolders,
  initialArticles,
  initialSourceId = null
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [folders, setFolders] = useState(initialFolders)
  const [activeSourceId, setActiveSourceId] = useState<string | null>(initialSourceId)
  const [articles, setArticles] = useState(initialArticles)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sortField, setSortField] = useState<SortField>("time")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [toast, setToast] = useState<{
    title: string
    description?: string
    tone?: "default" | "warning" | "success" | "error"
  } | null>(null)

  const loadSourceArticles = useCallback(async (sourceId: string) => {
    setLoading(true)
    try {
      const query = new URLSearchParams({
        sourceId,
        all: "1"
      })
      const response = await fetch(`/api/articles?${query.toString()}`)
      if (!response.ok) {
        throw new Error("文章加载失败")
      }
      const result = await response.json()
      setArticles(result.items ?? [])
    } catch (error) {
      setToast({
        title: error instanceof Error ? error.message : "文章加载失败",
        tone: "error"
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const sourceId = searchParams.get("sourceId")
    if (sourceId === activeSourceId) {
      return
    }

    setActiveSourceId(sourceId)
    setSearch("")
    setSelectedIds([])
    setStatusFilter("all")

    if (sourceId) {
      void loadSourceArticles(sourceId)
      return
    }

    setArticles([])
  }, [activeSourceId, loadSourceArticles, searchParams])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => articles.some((article) => article.id === id)))
  }, [articles])

  const activeFolder = useMemo(
    () => folders.find((item) => item.sourceId === activeSourceId) ?? null,
    [folders, activeSourceId]
  )

  const sortedFolders = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = keyword
      ? folders.filter((item) =>
          `${item.name} ${item.endpoint}`.toLowerCase().includes(keyword)
        )
      : folders

    return [...filtered].sort((a, b) => {
      if (a.kind === "manual" && b.kind !== "manual") return -1
      if (a.kind !== "manual" && b.kind === "manual") return 1
      return 0
    })
  }, [folders, search])

  const displayedArticles = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    let result = articles

    if (keyword) {
      result = result.filter((article) =>
        `${article.translatedTitle || article.title} ${article.author ?? ""} ${article.summary ?? ""}`
          .toLowerCase()
          .includes(keyword)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((article) => {
        if (statusFilter === "favorite") return article.favorite
        if (statusFilter === "reading") return !article.favorite && article.readProgress > 0
        return !article.favorite && article.readProgress === 0
      })
    }

    return [...result].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      if (sortField === "time") {
        const ta = new Date(a.publishedAt || a.createdAt).getTime()
        const tb = new Date(b.publishedAt || b.createdAt).getTime()
        return (ta - tb) * dir
      }
      const titleA = (a.translatedTitle || a.title).toLowerCase()
      const titleB = (b.translatedTitle || b.title).toLowerCase()
      return titleA.localeCompare(titleB) * dir
    })
  }, [articles, search, statusFilter, sortField, sortDir])

  const allDisplayedSelected = displayedArticles.length > 0
    && displayedArticles.every((article) => selectedIds.includes(article.id))

  const someSelected = selectedIds.length > 0

  const handleEnterFolder = useCallback((sourceId: string) => {
    setActiveSourceId(sourceId)
    setSearch("")
    setSelectedIds([])
    setSortField("time")
    setSortDir("desc")
    setStatusFilter("all")
    setArticles([])
    router.push(`/articles?sourceId=${sourceId}`, { scroll: false })
    void loadSourceArticles(sourceId)
  }, [loadSourceArticles, router])

  const handleBack = useCallback(() => {
    setActiveSourceId(null)
    setSearch("")
    setSelectedIds([])
    setArticles([])
    router.push("/articles")
  }, [router])

  const handleToggleArticle = useCallback((articleId: string) => {
    setSelectedIds((prev) =>
      prev.includes(articleId)
        ? prev.filter((id) => id !== articleId)
        : [...prev, articleId]
    )
  }, [])

  const handleToggleAllDisplayed = useCallback(() => {
    const visibleIds = displayedArticles.map((article) => article.id)
    if (visibleIds.length === 0) {
      return
    }
    setSelectedIds((prev) => {
      if (visibleIds.every((id) => prev.includes(id))) {
        return prev.filter((id) => !visibleIds.includes(id))
      }
      return Array.from(new Set([...prev, ...visibleIds]))
    })
  }, [displayedArticles])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0 || !activeSourceId) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/articles/bulk", {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ ids: selectedIds })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.error || "删除失败")
      }

      const deletedSet = new Set(selectedIds)
      setArticles((prev) => prev.filter((article) => !deletedSet.has(article.id)))
      setFolders((prev) =>
        prev
          .map((folder) => {
            if (folder.sourceId !== activeSourceId) {
              return folder
            }
            const nextCount = Math.max(0, folder.articleCount - selectedIds.length)
            return { ...folder, articleCount: nextCount }
          })
          .filter((folder) => folder.kind === "source" || folder.articleCount > 0)
      )
      setSelectedIds([])
      setShowDeleteConfirm(false)
      setToast({
        title: "已删除所选文章",
        description: `共删除 ${result.deletedCount ?? selectedIds.length} 篇`,
        tone: "success"
      })
    } catch (error) {
      setToast({
        title: error instanceof Error ? error.message : "删除失败",
        tone: "error"
      })
    } finally {
      setLoading(false)
    }
  }, [activeSourceId, selectedIds])

  const handleImported = useCallback(async ({
    status,
    item
  }: {
    status: "created" | "existing"
    item: ScoutArticle
  }) => {
    setShowImportDialog(false)
    setToast({
      title: status === "created" ? "文章已添加" : "文章已在列表中",
      description: item.title,
      tone: "success"
    })

    if (status === "created") {
      setFolders((prev) => {
        const existing = prev.find((folder) => folder.sourceId === item.sourceId)
        if (existing) {
          return prev.map((folder) =>
            folder.sourceId === item.sourceId
              ? {
                  ...folder,
                  articleCount: folder.articleCount + 1,
                  lastArticleAt: item.createdAt
                }
              : folder
          )
        }

        return [
          {
            sourceId: item.sourceId,
            kind: item.sourceId === "manual" ? "manual" : "source",
            name: item.channelName || "手动添加",
            endpoint: item.sourceId === "manual" ? "手动导入链接" : item.sourceUrl,
            protocol: item.sourceId === "manual" ? "manual" : "rss",
            status: "active",
            articleCount: 1,
            lastArticleAt: item.createdAt
          },
          ...prev
        ]
      })
    }

    if (activeSourceId === item.sourceId) {
      await loadSourceArticles(item.sourceId)
    }
  }, [activeSourceId, loadSourceArticles])

  const handleToggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }, [sortField])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-base">
      <header className="flex h-[72px] shrink-0 items-center justify-between px-8">
        <div className="flex items-center gap-3.5">
          {activeFolder ? (
            <>
              <button
                onClick={handleBack}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-border/60 bg-surface text-secondary transition-colors hover:text-foreground"
                aria-label="返回来源文件夹列表"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <h1 className="text-[20px] font-semibold tracking-tight text-foreground">
                {activeFolder.name}
              </h1>
            </>
          ) : (
            <h1 className="text-[24px] font-semibold tracking-tight text-foreground">文章</h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeFolder ? "搜索文章..." : "搜索来源文件夹..."}
              className="h-9 rounded-xl pl-9 pr-9 text-[13px]"
            />
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <Button
            size="sm"
            onClick={() => setShowImportDialog(true)}
            className="gap-1.5 rounded-xl px-3.5"
          >
            <Plus className="h-3.5 w-3.5" />
            添加链接
          </Button>
        </div>
      </header>

      <div className={cn("flex-1 overflow-y-auto px-8 pb-8", loading && "opacity-70")}>
        {activeFolder ? (
          <section className="overflow-hidden rounded-[16px] border border-border/60 bg-surface">
            <div className="flex items-center px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              <span className="flex w-9 justify-center">
                <button
                  onClick={handleToggleAllDisplayed}
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded transition-colors",
                    allDisplayedSelected
                      ? "bg-primary text-white"
                      : someSelected
                        ? "bg-primary/40 text-white"
                        : "border border-border/80 bg-transparent"
                  )}
                  aria-label="全选"
                >
                  {(allDisplayedSelected || someSelected) ? <Check className="h-2.5 w-2.5" /> : null}
                </button>
              </span>
              <button
                onClick={() => handleToggleSort("title")}
                className="flex w-[480px] items-center gap-1 transition-colors hover:text-foreground/60"
              >
                标题
                {sortField === "title" ? (
                  sortDir === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />
                ) : null}
              </button>
              <span className="w-[180px]">来源</span>
              <button
                onClick={() => handleToggleSort("time")}
                className="flex w-[120px] items-center gap-1 transition-colors hover:text-foreground/60"
              >
                时间
                {sortField === "time" ? (
                  sortDir === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />
                ) : null}
              </button>
              <div className="relative w-[80px]">
                <button
                  onClick={() => setShowStatusMenu((prev) => !prev)}
                  className="flex items-center gap-1 transition-colors hover:text-foreground/60"
                >
                  {statusFilter === "all" ? "状态" : statusFilterLabel(statusFilter)}
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
                {showStatusMenu ? (
                  <div className="absolute left-0 top-full z-10 mt-2 w-24 rounded-lg border border-border/60 bg-surface py-1 shadow-lg">
                    {(["all", "unread", "reading", "favorite"] as StatusFilter[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => { setStatusFilter(f); setShowStatusMenu(false) }}
                        className={cn(
                          "flex w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-elevated/60",
                          statusFilter === f ? "text-foreground" : "text-muted"
                        )}
                      >
                        {statusFilterLabel(f)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <span className="flex flex-1 justify-end">
                {someSelected ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-400/70 transition-colors hover:text-red-400"
                    aria-label="删除所选"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </span>
            </div>

            {displayedArticles.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-[13px] text-muted/50">
                {loading ? "加载中..." : "暂无文章"}
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {displayedArticles.map((article) => (
                  <SourceArticleRow
                    key={article.id}
                    article={article}
                    selected={selectedIds.includes(article.id)}
                    onToggleSelect={() => handleToggleArticle(article.id)}
                    onOpen={() => router.push(`/articles/${article.id}`)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div>
            {sortedFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted">
                <Folder className="mb-3 h-8 w-8 opacity-40" />
                <p className="text-[14px]">暂无来源</p>
              </div>
            ) : (
              <section className="overflow-hidden rounded-[16px] border border-border/60 bg-surface">
                <div className="flex items-center px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  <span className="w-[320px]">来源名称</span>
                  <span className="w-[280px]">订阅地址</span>
                  <span className="w-[100px]">文章数</span>
                  <span className="w-[140px]">最近更新</span>
                  <span className="flex-1" />
                </div>
                <div className="divide-y divide-border/40">
                  {sortedFolders.map((folder) => (
                    <button
                      key={folder.sourceId}
                      onClick={() => void handleEnterFolder(folder.sourceId)}
                      className="group flex w-full items-center px-6 py-4 text-left transition-colors hover:bg-elevated/40"
                    >
                      <div className="flex w-[320px] items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-elevated/60">
                          <SourceFolderIcon sourceId={folder.sourceId} className="h-8 w-8" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-foreground">{folder.name}</p>
                          <span className="mt-1 inline-flex rounded bg-elevated/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary">
                            {folder.protocol}
                          </span>
                        </div>
                      </div>
                      <span className="w-[280px] truncate text-[12px] text-muted">{folder.endpoint}</span>
                      <span className="w-[100px] text-[13px] font-medium text-foreground">{folder.articleCount} 篇</span>
                      <span className="w-[140px] text-[12px] text-secondary">
                        {folder.lastFetchedAt
                          ? `${formatTime(folder.lastFetchedAt)} 抓取`
                          : folder.lastArticleAt
                            ? `${formatTime(folder.lastArticleAt)} 添加`
                            : "尚未抓取"}
                      </span>
                      <span className="flex flex-1 justify-end">
                        <ChevronRight className="h-4 w-4 text-muted/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted" />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {showImportDialog ? (
        <ArticleLinkImportDialog
          onClose={() => setShowImportDialog(false)}
          onImported={handleImported}
        />
      ) : null}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="删除所选文章？"
        description={`将永久删除当前选中的 ${selectedIds.length} 篇文章，来源文件夹会保留。`}
        confirmText="确认删除"
        cancelText="取消"
        variant="danger"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleBulkDelete()}
      />

      {toast ? (
        <Toast
          title={toast.title}
          description={toast.description}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  )
}

function SourceArticleRow({
  article,
  selected,
  onToggleSelect,
  onOpen
}: {
  article: ScoutArticle
  selected: boolean
  onToggleSelect: () => void
  onOpen: () => void
}) {
  const statusLabel = article.favorite
    ? "已收藏"
    : article.readProgress > 0
      ? "阅读中"
      : "未读"
  const statusColor = article.favorite
    ? "text-primary/70"
    : article.readProgress > 0
      ? "text-foreground/50"
      : "text-muted/40"

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center px-5 py-4 text-left transition-colors hover:bg-elevated/40"
    >
      <span className="flex w-9 justify-center">
        <span
          onClick={(event) => {
            event.stopPropagation()
            onToggleSelect()
          }}
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded transition-colors",
            selected
              ? "bg-primary text-white"
              : "border border-border/80 bg-transparent text-transparent"
          )}
        >
          <Check className="h-2.5 w-2.5" />
        </span>
      </span>

      <div className="w-[480px] min-w-0 pr-4">
        <p className="truncate text-[13px] font-medium text-foreground">
          {article.translatedTitle || article.title}
        </p>
        <p className="mt-1 line-clamp-1 text-[12px] text-muted">
          {article.summary || "暂无摘要"}
        </p>
      </div>

      <div className="w-[180px] min-w-0">
        <p className="truncate text-[12px] text-secondary">{article.channelName}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {article.author || article.siteName || ""}
        </p>
      </div>

      <div className="w-[120px] text-[12px] text-muted">
        {formatArticlePublishedAtSummary(article.publishedAt || article.createdAt) || "刚刚"}
      </div>

      <div className="w-[80px]">
        <span className={cn("text-[12px]", statusColor)}>
          {statusLabel}
        </span>
      </div>

      <span className="flex-1" />
    </button>
  )
}

function statusFilterLabel(filter: StatusFilter): string {
  switch (filter) {
    case "all": return "全部"
    case "unread": return "未读"
    case "reading": return "阅读中"
    case "favorite": return "已收藏"
  }
}

function formatTime(value?: string) {
  if (!value) {
    return "未知"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "未知"
  }
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${month}-${day} ${hour}:${minute}`
}
