/**
 * Scout 抓取管线
 * Phase 1: RSS 抓取 → Phase 2: 内容清洗 → Phase 3: 文章生成 → Phase 4: AI 分析与 Patch 生成
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
import { analyzeEntries } from "@/src/server/services/scout/analyzer"
import type { ScoutTask, ScoutSource, ArticleSection } from "@/src/server/store/types"

interface RawEntry {
  url: string
  title: string
  content: string
  author?: string
  publishedAt?: string
  source: ScoutSource
}

/** 执行完整抓取管线 */
export async function runPipeline(userId: string, task: ScoutTask, jobId: string) {
  const job = repository.getJob(userId, jobId)
  if (!job) {
    return
  }

  try {
    const sources = task.sourceIds
      .map((id) => repository.getSource(userId, id))
      .filter((s): s is ScoutSource => s != null && s.status === "active")

    if (task.sourceIds.length > 0 && sources.length === 0) {
      throw new Error("任务未绑定任何可用信息源")
    }

    // ─── Phase 1: Fetch ───
    const rawEntries: RawEntry[] = []
    let fetchErrors = 0

    for (const source of sources) {
      try {
        const results = await fetchRss(source.endpoint)
        for (const item of results) {
          rawEntries.push({ ...item, source })
        }
      } catch {
        fetchErrors++
        repository.updateSource(userId, source.id, {
          lastError: "抓取失败",
          status: "error"
        })
      }
    }

    repository.updateJob(userId, jobId, {
      stages: {
        ...job.stages,
        fetch: { total: rawEntries.length, completed: rawEntries.length, errors: fetchErrors }
      }
    })

    // ─── Phase 2: Clean ───
    const filtered = rawEntries.filter((entry) => {
      const normalized = normalizeUrl(entry.url)
      if (repository.findEntryByUrl(userId, normalized)) return false

      const hash = contentHash(entry.content)
      if (repository.findEntryByHash(userId, hash)) return false

      const { includeKeywords, excludeKeywords } = entry.source
      const text = `${entry.title} ${entry.content}`.toLowerCase()

      if (includeKeywords.length > 0) {
        if (!includeKeywords.some((kw) => text.includes(kw.toLowerCase()))) return false
      }
      if (excludeKeywords.length > 0) {
        if (excludeKeywords.some((kw) => text.includes(kw.toLowerCase()))) return false
      }

      return true
    })

    // ─── Phase 3: Extract & Create ───
    const createdEntryIds: string[] = []
    let extractErrors = 0

    for (const raw of filtered) {
      const normalized = normalizeUrl(raw.url)
      const hash = contentHash(raw.content)
      const source = raw.source

      const entry = repository.createEntry({
        userId,
        sourceId: source.id,
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
      createdEntryIds.push(entry.id)

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
        sourceId: source.id,
        title: extracted?.title || raw.title,
        author,
        sourceUrl: raw.url,
        channelName: source.name,
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

      repository.updateSource(userId, source.id, {
        totalFetched: (source.totalFetched ?? 0) + 1,
        lastFetchedAt: new Date().toISOString(),
        lastError: undefined
      })
    }

    repository.updateJob(userId, jobId, {
      stages: {
        fetch: { total: rawEntries.length, completed: rawEntries.length, errors: fetchErrors },
        analyze: { total: filtered.length, completed: filtered.length, errors: extractErrors },
        patch: { total: createdEntryIds.length, generated: 0 }
      }
    })

    // ─── Phase 4: AI 分析与 Patch 生成 ───
    let patchGenerated = 0
    if (createdEntryIds.length > 0 && task.scopeViewpointIds.length > 0) {
      try {
        patchGenerated = await analyzeEntries(userId, task, createdEntryIds)

        // 更新来源的 patch 计数
        for (const source of sources) {
          const sourcePatches = createdEntryIds
            .map((id) => repository.getEntry(userId, id))
            .filter((e) => e?.sourceId === source.id)
            .length
          if (sourcePatches > 0) {
            repository.updateSource(userId, source.id, {
              totalPatches: (source.totalPatches ?? 0) + patchGenerated
            })
          }
        }
      } catch {
        // Phase 4 失败不影响整体管线
      }
    }

    repository.updateJob(userId, jobId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      stages: {
        fetch: { total: rawEntries.length, completed: rawEntries.length, errors: fetchErrors },
        analyze: { total: filtered.length, completed: filtered.length, errors: extractErrors },
        patch: { total: createdEntryIds.length, generated: patchGenerated }
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
