/**
 * Scout 最新抓取文章面板
 * 展示近期通过信息源抓取的文章列表
 *
 * @author Anner
 * @since 0.2.0
 */
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Clock, ExternalLink, FileText } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { formatArticlePublishedAtSummary } from "@/components/articles/article-published-at"
import type { ScoutArticle, ScoutSource } from "@/src/server/store/types"

interface Props {
  articles: ScoutArticle[]
  sources: ScoutSource[]
}

export function ScoutArticlesPanel({ articles, sources }: Props) {
  const router = useRouter()
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  const sourceMap = useMemo(() =>
    Object.fromEntries(sources.map((s) => [s.id, s])),
    [sources]
  )

  const filtered = useMemo(() => {
    if (!selectedSourceId) return articles
    return articles.filter((a) => a.sourceId === selectedSourceId)
  }, [articles, selectedSourceId])

  // 按来源分组统计
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of articles) {
      counts.set(a.sourceId, (counts.get(a.sourceId) ?? 0) + 1)
    }
    return counts
  }, [articles])

  return (
    <div className="flex h-full">
      {/* 左栏：来源筛选 */}
      <div className="w-52 shrink-0 border-r border-border overflow-y-auto px-3 py-3">
        <div className="mb-2 text-[11px] font-medium text-muted uppercase tracking-wide">
          按来源
        </div>
        <button
          onClick={() => setSelectedSourceId(null)}
          className={cn(
            "mb-0.5 flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
            !selectedSourceId ? "bg-selected text-foreground" : "text-muted hover:bg-overlay"
          )}
        >
          全部
          <span className="text-[11px]">{articles.length}</span>
        </button>
        {sources.map((source) => {
          const count = sourceCounts.get(source.id) ?? 0
          if (count === 0) return null
          return (
            <button
              key={source.id}
              onClick={() => setSelectedSourceId(source.id)}
              className={cn(
                "mb-0.5 flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                selectedSourceId === source.id ? "bg-selected text-foreground" : "text-muted hover:bg-overlay"
              )}
            >
              <span className="truncate">{source.name}</span>
              <span className="ml-1 shrink-0 text-[11px]">{count}</span>
            </button>
          )
        })}
      </div>

      {/* 文章列表 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <FileText className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-[14px]">暂无抓取文章</p>
            <p className="mt-1 text-[12px] text-muted/70">
              创建任务并执行后，抓取的文章会出现在这里
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((article) => {
              const source = sourceMap[article.sourceId]
              return (
                <button
                  key={article.id}
                  onClick={() => router.push(`/articles/${article.id}`)}
                  className="flex w-full flex-col gap-1.5 px-5 py-4 text-left hover:bg-overlay/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-[14px] font-medium text-foreground line-clamp-2">
                      {article.title}
                    </h3>
                    {article.sourceUrl && (
                      <a
                        href={article.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 text-muted hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {article.summary && (
                    <p className="text-[12px] text-muted line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted">
                    {source && <span>{source.name}</span>}
                    {article.author && <span>{article.author}</span>}
                    {article.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatArticlePublishedAtSummary(article.publishedAt)}
                      </span>
                    )}
                    {article.siteName && <span>{article.siteName}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
