/**
 * 文章库主页面
 * 主题网格 + 文章列表 + 搜索
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Clock,
  ExternalLink,
  FileText,
  Folder,
  Plus,
  Search,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/src/lib/utils"
import type { ScoutArticle, ArticleTopic } from "@/src/server/store/types"

interface Props {
  initialArticles: ScoutArticle[]
  initialTopics: ArticleTopic[]
}

/** 主题卡片配色 */
const TOPIC_COLORS = [
  "bg-[#1a1a2e]/60",
  "bg-[#1e2a1e]/60",
  "bg-[#2a1e1e]/60",
  "bg-[#1e1e2a]/60",
  "bg-[#2a2a1e]/60",
  "bg-[#1e2a2a]/60",
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

export function ArticlesClient({ initialArticles, initialTopics }: Props) {
  const router = useRouter()
  const [articles] = useState(initialArticles)
  const [topics] = useState(initialTopics)
  const [search, setSearch] = useState("")
  const [activeTopic, setActiveTopic] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (activeTopic && !a.topics.includes(activeTopic)) {
        return false
      }
      if (search && !`${a.title} ${a.author ?? ""}`.toLowerCase().includes(search.toLowerCase())) {
        return false
      }
      return true
    })
  }, [articles, activeTopic, search])

  /** 最近阅读的文章 */
  const recentRead = useMemo(() => {
    return [...articles]
      .filter((a) => a.lastReadAt)
      .sort((a, b) => (b.lastReadAt ?? "").localeCompare(a.lastReadAt ?? ""))
      .slice(0, 6)
  }, [articles])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 头部 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted" />
          <h1 className="text-[15px] font-medium text-foreground">文章</h1>
          <span className="text-[13px] text-muted">{articles.length} 篇</span>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文章..."
            className="h-8 pl-9 text-[13px]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="h-3 w-3 text-muted" />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* 主题网格 */}
        {topics.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[13px] font-medium text-muted">主题分类</h2>
            <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
              {topics.map((topic, i) => {
                const count = articles.filter((a) => a.topics.includes(topic.id)).length
                return (
                  <button
                    key={topic.id}
                    onClick={() => setActiveTopic(activeTopic === topic.id ? null : topic.id)}
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
                    <span className="text-[12px] text-muted">{count} 篇文章</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* 最近阅读 */}
        {recentRead.length > 0 && !search && !activeTopic && (
          <section className="mb-8">
            <h2 className="mb-3 text-[13px] font-medium text-muted">最近阅读</h2>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {recentRead.map((article) => (
                <ArticleRow
                  key={article.id}
                  article={article}
                  onClick={() => router.push(`/articles/${article.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 全部文章 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-muted">
              {activeTopic ? "筛选结果" : "全部文章"}
            </h2>
            {activeTopic && (
              <button
                onClick={() => setActiveTopic(null)}
                className="text-[12px] text-primary hover:underline"
              >
                清除筛选
              </button>
            )}
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
              <FileText className="mb-3 h-8 w-8 opacity-40" />
              <p className="text-[14px]">暂无文章</p>
              <p className="text-[12px]">Scout 抓取的文章将出现在这里</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((article) => (
                <ArticleRow
                  key={article.id}
                  article={article}
                  onClick={() => router.push(`/articles/${article.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ArticleRow({
  article,
  onClick
}: {
  article: ScoutArticle
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-lg border border-border/40 bg-card/40 p-3 text-left transition-colors hover:bg-overlay/60"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {article.title}
        </p>
        <p className="mt-1 text-[12px] text-muted line-clamp-1">
          {article.summary}
        </p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
          {article.author && <span>{article.author}</span>}
          {article.channelName && (
            <span className="flex items-center gap-1">
              <ExternalLink className="h-2.5 w-2.5" />
              {article.channelName}
            </span>
          )}
          {article.publishedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(article.publishedAt)}
            </span>
          )}
          {article.readProgress > 0 && (
            <span>{Math.round(article.readProgress * 100)}%</span>
          )}
        </div>
      </div>
    </button>
  )
}
