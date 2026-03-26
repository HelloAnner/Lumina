/**
 * 文章库主页面
 * 筛选 Tab + 主题网格 + 手动链接导入 + 分页列表 + 归档
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Archive,
  ArchiveRestore,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Folder,
  Search,
  Star,
  Trash2,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { cn } from "@/src/lib/utils"
import { ArticleLinkImportDialog } from "@/components/articles/article-link-import-dialog"
import { formatArticlePublishedAtSummary } from "@/components/articles/article-published-at"
import type { ScoutArticle, ArticleTopic } from "@/src/server/store/types"
import type { ArticleSortBy } from "@/src/server/services/preferences/store"

type FilterTab = "all" | "unread" | "reading" | "favorite" | "archived"

interface PaginatedResult {
  items: ScoutArticle[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface Props {
  initialData: PaginatedResult
  initialTopics: ArticleTopic[]
  initialSortBy?: ArticleSortBy
  archiveRetentionDays?: number
}

const SORT_OPTIONS: { key: ArticleSortBy; label: string }[] = [
  { key: "lastRead", label: "最近阅读" },
  { key: "created", label: "创建时间" }
]

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "unread", label: "未读" },
  { key: "reading", label: "阅读中" },
  { key: "favorite", label: "收藏" },
  { key: "archived", label: "已归档" }
]

const TOPIC_COLORS = [
  "bg-[#1a1a2e]/60",
  "bg-[#1e2a1e]/60",
  "bg-[#2a1e1e]/60",
  "bg-[#1e1e2a]/60",
  "bg-[#2a2a1e]/60",
  "bg-[#1e2a2a]/60"
]

export function ArticlesClient({ initialData, initialTopics, initialSortBy = "lastRead", archiveRetentionDays = 30 }: Props) {
  const router = useRouter()
  const [data, setData] = useState<PaginatedResult>(initialData)
  const [topics] = useState(initialTopics)
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all")
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<ArticleSortBy>(initialSortBy)
  const [loading, setLoading] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [toast, setToast] = useState<{
    title: string
    description?: string
    tone?: "default" | "warning" | "success" | "error"
  } | null>(null)

  /** 从 API 获取分页数据 */
  const fetchArticles = useCallback(async (params: {
    filter?: string
    topicId?: string
    search?: string
    sortBy?: string
    page?: number
  }) => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      if (params.filter) {
        query.set("filter", params.filter)
      }
      if (params.topicId) {
        query.set("topicId", params.topicId)
      }
      if (params.search) {
        query.set("search", params.search)
      }
      if (params.sortBy) {
        query.set("sortBy", params.sortBy)
      }
      if (params.page) {
        query.set("page", String(params.page))
      }
      const res = await fetch(`/api/articles?${query.toString()}`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleFilterChange = (tab: FilterTab) => {
    setActiveFilter(tab)
    setActiveTopic(null)
    fetchArticles({ filter: tab, search, sortBy })
  }

  const handleTopicClick = (topicId: string) => {
    const next = activeTopic === topicId ? null : topicId
    setActiveTopic(next)
    fetchArticles({ filter: activeFilter, topicId: next ?? undefined, search, sortBy })
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    fetchArticles({ filter: activeFilter, topicId: activeTopic ?? undefined, search: value, sortBy })
  }

  const handlePageChange = (page: number) => {
    fetchArticles({ filter: activeFilter, topicId: activeTopic ?? undefined, search, sortBy, page })
  }

  const handleSortChange = (next: ArticleSortBy) => {
    setSortBy(next)
    fetchArticles({ filter: activeFilter, topicId: activeTopic ?? undefined, search, sortBy: next })
    fetch("/api/preferences/ui", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ articleSortBy: next })
    }).catch(() => undefined)
  }

  const refetch = useCallback(() => {
    fetchArticles({
      filter: activeFilter,
      topicId: activeTopic ?? undefined,
      search,
      sortBy,
      page: data.page
    })
  }, [fetchArticles, activeFilter, activeTopic, search, sortBy, data.page])

  /** 归档（软删除） */
  const handleArchive = async (articleId: string) => {
    await fetch(`/api/articles/${articleId}`, { method: "DELETE" })
    refetch()
  }

  /** 从归档恢复 */
  const handleRestore = async (articleId: string) => {
    await fetch(`/api/articles/${articleId}/restore`, { method: "POST" })
    refetch()
  }

  /** 永久删除 */
  const handlePermanentDelete = async (articleId: string) => {
    const response = await fetch(`/api/articles/${articleId}/permanent`, { method: "DELETE" })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setToast({
        title: data.error || "删除失败",
        tone: "error"
      })
      return
    }
    refetch()
  }

  const handleFavorite = async (articleId: string, favorite: boolean) => {
    const response = await fetch(
      `/api/articles/${articleId}/${favorite ? "unfavorite" : "favorite"}`,
      { method: "POST" }
    )
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setToast({
        title: data.error || "收藏操作失败",
        tone: "error"
      })
      return
    }
    refetch()
    setToast({
      title: favorite ? "已取消收藏" : "已收藏",
      description: favorite ? undefined : "系统将自动补全主题标签",
      tone: "success"
    })
  }

  const handleImported = async ({
    status,
    item
  }: {
    status: "created" | "existing"
    item: ScoutArticle
  }) => {
    setShowImportDialog(false)
    setSearch("")
    setActiveFilter("all")
    setActiveTopic(null)
    await fetchArticles({
      filter: "all",
      sortBy,
      page: 1
    })
    setToast({
      title: status === "created" ? "文章已添加" : "文章已在列表中",
      description: item.title,
      tone: "success"
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 头部 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted" />
          <h1 className="text-[15px] font-medium text-foreground">文章</h1>
          <span className="text-[13px] text-muted">{data.total} 篇</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="搜索文章..."
              className="h-8 pl-9 text-[13px]"
            />
            {search && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="h-3 w-3 text-muted" />
              </button>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowImportDialog(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            添加链接
          </Button>
        </div>
      </header>

      {/* 筛选 Tab + 排序 */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={cn(
                "px-4 py-2 text-[13px] transition-colors",
                activeFilter === tab.key
                  ? "border-b-2 border-primary font-medium text-foreground"
                  : "text-muted hover:text-secondary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-[12px] text-muted">
          <ArrowDownUp className="h-3 w-3" />
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSortChange(opt.key)}
              className={cn(
                "rounded px-2 py-1 transition-colors",
                sortBy === opt.key
                  ? "text-foreground"
                  : "hover:text-secondary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("flex-1 overflow-y-auto px-6 py-5", loading && "opacity-60")}>
        {/* 主题网格 */}
        {topics.length > 0 && activeFilter !== "archived" && (
          <section className="mb-8">
            <h2 className="mb-3 text-[13px] font-medium text-muted">主题分类</h2>
            <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
              {topics.map((topic, i) => (
                <button
                  key={topic.id}
                  onClick={() => handleTopicClick(topic.id)}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border border-border/50 p-4 text-left transition-colors",
                    TOPIC_COLORS[i % TOPIC_COLORS.length],
                    activeTopic === topic.id
                      ? "border-primary/40 ring-1 ring-primary/20"
                      : "hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="h-3.5 w-3.5 text-muted" />
                    <span className="text-[14px] font-medium text-foreground">{topic.name}</span>
                  </div>
                  <span className="text-[12px] text-muted">{topic.articleCount} 篇文章</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 文章列表 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-muted">
              {activeTopic
                ? topics.find((t) => t.id === activeTopic)?.name ?? "筛选结果"
                : FILTER_TABS.find((t) => t.key === activeFilter)?.label ?? "全部文章"}
            </h2>
            {activeTopic && (
              <button
                onClick={() => handleTopicClick(activeTopic)}
                className="text-[12px] text-primary hover:underline"
              >
                清除筛选
              </button>
            )}
          </div>

          {data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
              <FileText className="mb-3 h-8 w-8 opacity-40" />
              <p className="text-[14px]">暂无文章</p>
              <p className="text-[12px]">Scout 抓取的文章将出现在这里</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {data.items.map((article) => (
                <ArticleRow
                  key={article.id}
                  article={article}
                  isArchivedView={activeFilter === "archived"}
                  archiveRetentionDays={archiveRetentionDays}
                  onClick={() => router.push(`/articles/${article.id}`)}
                  onFavorite={() => handleFavorite(article.id, Boolean(article.favorite))}
                  onArchive={() => handleArchive(article.id)}
                  onRestore={() => handleRestore(article.id)}
                  onPermanentDelete={() => handlePermanentDelete(article.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 分页 */}
        {data.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] text-muted">
              第 {data.page} / {data.totalPages} 页
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => handlePageChange(data.page - 1)}
                className="h-7 gap-1 px-2.5 text-[12px]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                上一页
              </Button>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (data.totalPages <= 5) {
                    return true
                  }
                  return Math.abs(p - data.page) <= 1 || p === 1 || p === data.totalPages
                })
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1]
                  const showEllipsis = prev !== undefined && p - prev > 1
                  return (
                    <span key={p} className="flex items-center">
                      {showEllipsis && (
                        <span className="px-1 text-[12px] text-muted">...</span>
                      )}
                      <button
                        onClick={() => handlePageChange(p)}
                        className={cn(
                          "flex h-7 min-w-[28px] items-center justify-center rounded-md px-2 text-[12px] transition-colors",
                          p === data.page
                            ? "bg-primary text-white"
                            : "text-muted hover:text-foreground"
                        )}
                      >
                        {p}
                      </button>
                    </span>
                  )
                })}
              <Button
                variant="secondary"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => handlePageChange(data.page + 1)}
                className="h-7 gap-1 px-2.5 text-[12px]"
              >
                下一页
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {showImportDialog ? (
        <ArticleLinkImportDialog
          onClose={() => setShowImportDialog(false)}
          onImported={handleImported}
        />
      ) : null}
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

function ArticleRow({
  article,
  isArchivedView,
  archiveRetentionDays = 30,
  onClick,
  onFavorite,
  onArchive,
  onRestore,
  onPermanentDelete
}: {
  article: ScoutArticle
  isArchivedView: boolean
  archiveRetentionDays?: number
  onClick: () => void
  onFavorite: () => void
  onArchive: () => void
  onRestore: () => void
  onPermanentDelete: () => void
}) {
  const readLabel = article.archived
    ? "已归档"
    : article.reading
      ? article.readProgress >= 1
        ? "已读完"
        : article.readProgress > 0
          ? `阅读 ${Math.round(article.readProgress * 100)}%`
          : "阅读中"
      : "未读"
  const readColor = article.archived
    ? "text-placeholder"
    : article.reading
      ? article.readProgress >= 1
        ? "text-success"
        : "text-primary"
      : "text-placeholder"

  // 归档过期提示
  let expiryHint = ""
  if (isArchivedView && archiveRetentionDays > 0 && article.archivedAt) {
    const elapsed = Date.now() - new Date(article.archivedAt).getTime()
    const remaining = archiveRetentionDays * 86_400_000 - elapsed
    const remainingDays = Math.ceil(remaining / 86_400_000)
    if (remainingDays <= 7 && remainingDays > 0) {
      expiryHint = `${remainingDays} 天后自动删除`
    }
  }

  return (
    <div className="group flex items-start gap-3 rounded-lg border border-border/40 bg-card/40 p-3.5 transition-colors hover:bg-overlay/60">
      <button onClick={onClick} className="flex-1 min-w-0 text-left">
        <p className="text-[14px] font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {article.translationView === "translation" && article.translatedTitle
            ? article.translatedTitle
            : article.title}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-[12px]">
          {article.author && <span className="text-secondary">{article.author}</span>}
          {article.channelName && (
            <span className="flex items-center gap-1 text-muted">
              <ExternalLink className="h-2.5 w-2.5" />
              {article.channelName}
            </span>
          )}
          {article.publishedAt && (
            <span className="flex items-center gap-1 text-muted">
              <Clock className="h-2.5 w-2.5" />
              {formatArticlePublishedAtSummary(article.publishedAt)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          {article.highlightCount > 0 && (
            <span className="text-muted">{article.highlightCount} 条划线</span>
          )}
          {article.favorite ? (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
              已收藏
            </span>
          ) : null}
          <span className={readColor}>{readLabel}</span>
          {expiryHint && (
            <span className="text-destructive/70">{expiryHint}</span>
          )}
          {article.topics.length > 0 && (
            <span className="ml-auto rounded bg-elevated px-2 py-0.5 text-[10px] text-muted">
              {article.topics.length} 个主题
            </span>
          )}
        </div>
      </button>
      <div className="mt-1 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite() }}
          className={cn(
            "rounded-md p-1.5 transition-colors hover:bg-elevated",
            article.favorite
              ? "text-amber-300"
              : "text-muted hover:text-amber-200"
          )}
          title={article.favorite ? "取消收藏" : "收藏"}
        >
          <Star className={cn("h-3.5 w-3.5", article.favorite && "fill-current")} />
        </button>
        {isArchivedView ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onRestore() }}
              className="rounded-md p-1.5 text-primary transition-colors hover:bg-elevated"
              title="恢复"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onPermanentDelete() }}
              className="rounded-md p-1.5 text-destructive transition-colors hover:bg-elevated"
              title="永久删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onArchive() }}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-elevated hover:text-secondary"
            title="归档"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
