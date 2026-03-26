/**
 * Scout 抓取管线
 * Phase 1-3: RSS 抓取 → 内容清洗 → 文章生成
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
import { randomUUID } from "node:crypto"
import { repository } from "@/src/server/repositories"
import { persistArticleAssets } from "@/src/server/services/articles/assets"
import { fetchRss } from "@/src/server/services/scout/rss-fetcher"
import { fetchAndExtract } from "@/src/server/services/scout/content-extractor"
import { normalizeUrl, contentHash } from "@/src/server/services/scout/url-utils"
import type { ScoutTask, ArticleSection } from "@/src/server/store/types"

/** 执行完整抓取管线 */
export async function runPipeline(userId: string, task: ScoutTask, jobId: string) {
  const job = repository.getJob(userId, jobId)
  if (!job) {
    return
  }

  try {
    const sources = task.sourceIds
      .map((id) => repository.getSource(userId, id))
      .filter(Boolean)

    // Stage 1: Fetch
    const rawEntries: { url: string; title: string; content: string; author?: string; publishedAt?: string }[] = []

    for (const source of sources) {
      if (!source || source.status !== "active") {
        continue
      }
      try {
        const results = await fetchRss(source.endpoint)
        rawEntries.push(...results)
        repository.updateJob(userId, jobId, {
          stages: {
            ...job.stages,
            fetch: { total: rawEntries.length, completed: rawEntries.length, errors: 0 }
          }
        })
      } catch {
        repository.updateJob(userId, jobId, {
          stages: {
            ...job.stages,
            fetch: { ...job.stages.fetch, errors: job.stages.fetch.errors + 1 }
          }
        })
      }
    }

    // Stage 2: Clean — 去重 + 关键词过滤
    const filtered = rawEntries.filter((entry) => {
      const hash = contentHash(entry.content)
      if (repository.findEntryByHash(userId, hash)) {
        return false
      }
      return true
    })

    // Stage 3: 正文提取 + 创建条目与文章
    let extractErrors = 0
    for (const raw of filtered) {
      const normalized = normalizeUrl(raw.url)
      const hash = contentHash(raw.content)

      const entry = repository.createEntry({
        userId,
        sourceId: sources[0]?.id ?? "",
        taskId: task.id,
        sourceUrl: raw.url,
        normalizedUrl: normalized,
        contentHash: hash,
        status: "raw",
        title: raw.title,
        content: raw.content,
        author: raw.author,
        publishedAt: raw.publishedAt,
        fetchedAt: new Date().toISOString()
      })

      // 尝试提取原文正文，失败则降级为 RSS 原始内容
      const extracted = await fetchAndExtract(raw.url)

      let sections: ArticleSection[]
      let summary: string
      let author = raw.author
      let siteName: string | undefined
      let coverImage: string | undefined

      if (extracted && extracted.content.length > 0) {
        sections = extracted.content
        summary = extracted.summary
        author = extracted.author ?? raw.author
        siteName = extracted.siteName
        coverImage = extracted.coverImage
      } else {
        extractErrors++
        sections = [
          { id: `${entry.id}-h`, type: "heading", level: 1, text: raw.title },
          { id: `${entry.id}-p`, type: "paragraph", text: raw.content }
        ]
        summary = raw.content.slice(0, 200)
      }

      const articleId = randomUUID()
      const withAssets = await persistArticleAssets({
        userId,
        articleId,
        content: sections,
        coverImage
      })

      repository.createArticle({
        id: articleId,
        userId,
        entryId: entry.id,
        sourceId: sources[0]?.id ?? "",
        title: extracted?.title || raw.title,
        author,
        sourceUrl: raw.url,
        channelName: sources[0]?.name ?? "",
        channelIcon: "",
        publishedAt: raw.publishedAt,
        topics: [],
        summary,
        content: withAssets.content,
        readProgress: 0,
        highlightCount: 0,
        siteName,
        coverImage: withAssets.coverImage,
        status: "ready"
      })

      repository.updateSource(userId, sources[0]?.id ?? "", {
        totalFetched: (sources[0]?.totalFetched ?? 0) + 1,
        lastFetchedAt: new Date().toISOString()
      })
    }

    repository.updateJob(userId, jobId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      stages: {
        fetch: { total: rawEntries.length, completed: rawEntries.length, errors: 0 },
        analyze: { total: filtered.length, completed: filtered.length, errors: 0 },
        patch: { total: 0, generated: 0 }
      }
    })

    repository.updateTask(userId, task.id, {
      lastRunAt: new Date().toISOString(),
      totalRuns: task.totalRuns + 1
    })
  } catch (error) {
    repository.updateJob(userId, jobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      completedAt: new Date().toISOString()
    })
  }
}
