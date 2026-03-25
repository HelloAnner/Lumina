/**
 * 文章库主页面
 * 筛选 Tab + 主题网格 + 分页列表 + 归档
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Folder,
  Search,
  Trash2,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/src/lib/utils"
import type { ScoutArticle, ArticleTopic } from "@/src/server/store/types"

type FilterTab = "all" | "unread" | "reading" | "archived"

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
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "unread", label: "未读" },
  { key: "reading", label: "阅读中" },
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

function timeAgo(dateStr?: string): string {
  if (!dateStr) {
    return ""
  }
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ArticlesClient({ initialData, initialTopics }: Props) {
  const router = useRouter()
  const [data, setData] = useState<PaginatedResult>(initialData)
  const [topics] = useState(initialTopics)
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all")
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /** 从 API 获取分页数据 */
  const fetchArticles = useCallback(async (params: {
    filter?: string
    topicId?: string
    search?: string
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
    fetchArticles({ filter: tab, search })
  }

  const handleTopicClick = (topicId: string) => {
    const next = activeTopic === topicId ? null : topicId
    setActiveTopic(next)
    fetchArticles({ filter: activeFilter, topicId: next ?? undefined, search })
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    fetchArticles({ filter: activeFilter, topicId: activeTopic ?? undefined, search: value })
  }

  const handlePageChange = (page: number) => {
    fetchArticles({ filter: activeFilter, topicId: activeTopic ?? undefined, search, page })
  }

  const refetch = useCallback(() => {
    fetchArticles({
      filter: activeFilter,
      topicId: activeTopic ?? undefined,
      search,
      page: data.page
    })
  }, [fetchArticles, activeFilter, activeTopic, search, data.page])

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
    await fetch(`/api/articles/${articleId}/permanent`, { method: "DELETE" })
    refetch()
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
      </header>

      {/* 筛选 Tab */}
      <div className="flex shrink-0 items-center border-b border-border px-6">
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
                  onClick={() => router.push(`/articles/${article.id}`)}
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
    </div>
  )
}

function ArticleRow({
  article,
  isArchivedView,
  onClick,
  onArchive,
  onRestore,
  onPermanentDelete
}: {
  article: ScoutArticle
  isArchivedView: boolean
  onClick: () => void
  onArchive: () => void
  onRestore: () => void
  onPermanentDelete: () => void
}) {
  const readLabel = article.archived
    ? "已归档"
    : article.readProgress >= 1
      ? "已读完"
      : article.readProgress > 0
        ? `阅读 ${Math.round(article.readProgress * 100)}%`
        : "未读"
  const readColor = article.archived
    ? "text-placeholder"
    : article.readProgress >= 1
      ? "text-success"
      : article.readProgress > 0
        ? "text-primary"
        : "text-placeholder"

  return (
    <div className="group flex items-start gap-3 rounded-lg border border-border/40 bg-card/40 p-3.5 transition-colors hover:bg-overlay/60">
      <button onClick={onClick} className="flex-1 min-w-0 text-left">
        <p className="text-[14px] font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {article.title}
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
              {timeAgo(article.publishedAt)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          {article.highlightCount > 0 && (
            <span className="text-muted">{article.highlightCount} 条划线</span>
          )}
          <span className={readColor}>{readLabel}</span>
          {article.topics.length > 0 && (
            <span className="ml-auto rounded bg-elevated px-2 py-0.5 text-[10px] text-muted">
              {article.topics.length} 个主题
            </span>
          )}
        </div>
      </button>
      <div className="mt-1 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
