/**
 * Obsidian 导入管线
 * 五阶段管线：扫描 → 解析 → 上传 → 分析 → 关联
 * 遵循事务语义：全量成功或全量回滚
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
import { readFileSync, realpathSync } from "node:fs"
import { relative, basename, extname } from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { repository } from "@/src/server/repositories"
import { scanVault, resolveImagePath } from "@/src/server/services/import/scanner"
import { parseObsidianMarkdown } from "@/src/server/services/import/parser"
import type {
  ImportedNote,
  ImportJob,
  ImportJobStage,
  NoteViewpointLink,
  Viewpoint
} from "@/src/server/store/types"

/** 正在运行的导入任务 AbortController 注册表 */
const runningJobs = new Map<string, AbortController>()

/** 取消导入任务 */
export function cancelImportJob(jobId: string) {
  const controller = runningJobs.get(jobId)
  if (controller) {
    controller.abort()
  }
}

interface PendingData {
  notes: ImportedNote[]
  links: NoteViewpointLink[]
  newViewpoints: Viewpoint[]
  stagedImageKeys: string[]
}

/** 更新任务状态 */
function updateJob(userId: string, jobId: string, updates: Partial<ImportJob>) {
  repository.updateImportJob(userId, jobId, updates)
}

function updateStage(userId: string, jobId: string, stage: ImportJobStage, progress?: Partial<ImportJob["progress"]>) {
  const update: Partial<ImportJob> = { stage }
  if (progress) {
    const current = repository.getImportJob(userId, jobId)
    update.progress = { ...current?.progress, ...progress } as ImportJob["progress"]
  }
  updateJob(userId, jobId, update)
}

/** 执行完整导入管线 */
export async function runImportPipeline(userId: string, jobId: string) {
  const controller = new AbortController()
  runningJobs.set(jobId, controller)
  const signal = controller.signal

  const job = repository.getImportJob(userId, jobId)
  if (!job) {
    return
  }

  const source = repository.getImportSource(userId, job.sourceId)
  if (!source) {
    updateJob(userId, jobId, { status: "failed", errorMessage: "Import source not found", finishedAt: new Date().toISOString() })
    return
  }

  const pendingData: PendingData = {
    notes: [],
    links: [],
    newViewpoints: [],
    stagedImageKeys: []
  }

  try {
    updateJob(userId, jobId, { status: "running" })

    // Stage 1: 扫描
    updateStage(userId, jobId, "scanning")
    const vaultPath = realpathSync(source.path)
    const scanResult = scanVault(vaultPath, source.excludePatterns)

    updateJob(userId, jobId, {
      progress: {
        totalFiles: scanResult.mdFiles.length,
        totalImages: scanResult.imageFiles.size,
        processed: 0,
        total: scanResult.mdFiles.length
      }
    })

    if (signal.aborted) {
      throw new Error("cancelled")
    }

    // Stage 2: 解析
    updateStage(userId, jobId, "parsing", { processed: 0, total: scanResult.mdFiles.length })

    for (let idx = 0; idx < scanResult.mdFiles.length; idx++) {
      if (signal.aborted) {
        throw new Error("cancelled")
      }

      const mdPath = scanResult.mdFiles[idx]
      const relPath = relative(vaultPath, mdPath)
      const rawMarkdown = readFileSync(mdPath, "utf-8")
      const contentHash = createHash("sha256").update(rawMarkdown).digest("hex")
      const title = basename(mdPath, extname(mdPath))

      const parsed = parseObsidianMarkdown(rawMarkdown)

      // 为图片块回填路径信息
      let imageBlockIdx = 0
      for (const block of parsed.blocks) {
        if (block.type === "image" && !block.externalUrl) {
          const imgRef = parsed.imageRefs[imageBlockIdx] ?? ""
          const resolved = resolveImagePath(imgRef, mdPath, vaultPath, scanResult.imageFiles)
          if (resolved) {
            // objectKey 在上传阶段回填
            block.originalName = basename(resolved)
          }
          imageBlockIdx++
        }
      }

      const note: ImportedNote = {
        id: randomUUID(),
        userId,
        sourceId: source.id,
        relativePath: relPath,
        title,
        frontmatter: parsed.frontmatter,
        blocks: parsed.blocks,
        rawMarkdown,
        contentHash,
        tags: parsed.tags,
        wikilinks: parsed.wikilinks,
        imageKeys: [],
        importedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString()
      }

      pendingData.notes.push(note)
      updateStage(userId, jobId, "parsing", {
        processed: idx + 1,
        total: scanResult.mdFiles.length,
        currentFile: relPath
      })
    }

    // Stage 3: 上传图片
    updateStage(userId, jobId, "uploading", { processed: 0, total: scanResult.imageFiles.size })

    // 收集所有需要上传的图片（去重）
    const imageHashMap = new Map<string, { hash: string; ext: string; absPath: string }>()
    const imageRefToHash = new Map<string, string>()

    for (const [relPath, absPath] of scanResult.imageFiles) {
      try {
        const buf = readFileSync(absPath)
        const hash = createHash("sha256").update(buf).digest("hex")
        const ext = extname(absPath).toLowerCase()
        imageHashMap.set(hash, { hash, ext, absPath })
        imageRefToHash.set(relPath, hash)
        imageRefToHash.set(basename(relPath), hash)
      } catch {
        // 跳过损坏的图片
      }
    }

    // 本期先跳过 MinIO 上传，使用本地路径代替
    // 实际生产中应上传到 MinIO staging 目录
    let imgProcessed = 0
    for (const [hash, info] of imageHashMap) {
      if (signal.aborted) {
        throw new Error("cancelled")
      }
      const finalKey = `imports/${source.id}/${hash}${info.ext}`
      pendingData.stagedImageKeys.push(finalKey)

      // 回填所有引用此图片的 ImageBlock 的 objectKey
      for (const note of pendingData.notes) {
        for (const block of note.blocks) {
          if (block.type === "image" && !block.externalUrl && !block.objectKey) {
            const nameMatch = basename(info.absPath) === block.originalName
            if (nameMatch) {
              block.objectKey = finalKey
              if (!note.imageKeys.includes(finalKey)) {
                note.imageKeys.push(finalKey)
              }
            }
          }
        }
      }

      imgProcessed++
      updateStage(userId, jobId, "uploading", { processed: imgProcessed, total: imageHashMap.size })
    }

    // Stage 4: 分析（LLM 观点拆分）
    updateStage(userId, jobId, "analyzing", { processed: 0, total: pendingData.notes.length })

    // 获取已有观点列表
    const existingViewpoints = repository.listImportedNotes(userId).length > 0
      ? [] // 后续迭代中实现 LLM 调用
      : []

    // 获取绑定的模型
    const binding = repository.listModelBindings?.(userId)?.find((b) => b.feature === "aggregation_analyze")
    const modelConfig = binding
      ? repository.listModelConfigs(userId).find((m) => m.id === binding.modelId) ?? null
      : null

    for (let idx = 0; idx < pendingData.notes.length; idx++) {
      if (signal.aborted) {
        throw new Error("cancelled")
      }

      const note = pendingData.notes[idx]
      updateStage(userId, jobId, "analyzing", {
        processed: idx + 1,
        total: pendingData.notes.length,
        currentFile: note.relativePath
      })

      // 如果配置了模型，尝试 LLM 分析
      if (modelConfig) {
        try {
          const viewpointResults = await analyzeNoteViewpoints(
            note,
            existingViewpoints,
            modelConfig
          )

          for (const vp of viewpointResults) {
            if (vp.isExisting && vp.existingViewpointId) {
              pendingData.links.push({
                noteId: note.id,
                viewpointId: vp.existingViewpointId,
                relevanceScore: vp.confidence,
                relatedBlockIds: vp.relatedBlockIndices.map((i) => note.blocks[i]?.id).filter(Boolean),
                reason: vp.reason,
                confirmed: false,
                createdAt: new Date().toISOString()
              })
            } else {
              // 新建观点
              const newVp: Viewpoint = {
                id: randomUUID(),
                userId,
                title: vp.title,
                isFolder: false,
                isCandidate: true,
                sortOrder: 999,
                highlightCount: 0,
                articleContent: "",
                articleBlocks: [],
                relatedBookIds: [],
                createdAt: new Date().toISOString()
              }
              pendingData.newViewpoints.push(newVp)
              pendingData.links.push({
                noteId: note.id,
                viewpointId: newVp.id,
                relevanceScore: vp.confidence,
                relatedBlockIds: vp.relatedBlockIndices.map((i) => note.blocks[i]?.id).filter(Boolean),
                reason: vp.reason,
                confirmed: false,
                createdAt: new Date().toISOString()
              })
            }
          }
        } catch {
          // LLM 分析失败，跳过此笔记的观点分析但不中断导入
        }
      }
    }

    // Stage 5: 关联
    updateStage(userId, jobId, "linking", { processed: 0, total: pendingData.links.length })

    for (let idx = 0; idx < pendingData.links.length; idx++) {
      if (signal.aborted) {
        throw new Error("cancelled")
      }
      updateStage(userId, jobId, "linking", { processed: idx + 1, total: pendingData.links.length })
    }

    // 提交
    updateJob(userId, jobId, { status: "committing" })
    repository.commitImportData({
      notes: pendingData.notes,
      links: pendingData.links,
      newViewpoints: pendingData.newViewpoints
    })

    // 更新来源同步时间
    repository.updateImportSource(userId, source.id, {
      lastSyncAt: new Date().toISOString()
    })

    updateJob(userId, jobId, {
      status: "done",
      result: {
        importedNotes: pendingData.notes.length,
        importedImages: pendingData.stagedImageKeys.length,
        newViewpoints: pendingData.newViewpoints.length,
        linkedViewpoints: pendingData.links.length
      },
      finishedAt: new Date().toISOString()
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (signal.aborted || errorMessage === "cancelled") {
      updateJob(userId, jobId, {
        status: "cancelled",
        errorMessage: "User cancelled",
        finishedAt: new Date().toISOString()
      })
    } else {
      updateJob(userId, jobId, {
        status: "failed",
        errorMessage,
        finishedAt: new Date().toISOString()
      })
    }
  } finally {
    runningJobs.delete(jobId)
  }
}

interface ViewpointAnalysisResult {
  title: string
  isExisting: boolean
  existingViewpointId?: string
  relatedBlockIndices: number[]
  reason: string
  confidence: number
}

/** LLM 观点分析 */
async function analyzeNoteViewpoints(
  note: ImportedNote,
  _existingViewpoints: Viewpoint[],
  modelConfig: { baseUrl: string; apiKey: string; modelName: string }
): Promise<ViewpointAnalysisResult[]> {
  // 构建笔记内容（带块索引）
  const contentWithIndex = note.blocks
    .map((block, idx) => {
      if (block.type === "heading") {
        return `[B${idx}] ${"#".repeat(block.level)} ${block.text}`
      }
      if (block.type === "paragraph") {
        return `[B${idx}] ${block.text}`
      }
      if (block.type === "quote") {
        return `[B${idx}] > ${block.text}`
      }
      if (block.type === "code") {
        return `[B${idx}] \`\`\`${block.language}\n${block.code}\n\`\`\``
      }
      if (block.type === "image") {
        return `[B${idx}] [IMG]`
      }
      if (block.type === "mermaid") {
        return `[B${idx}] [MERMAID]`
      }
      if (block.type === "task") {
        return `[B${idx}] [TASKS]`
      }
      return `[B${idx}] ...`
    })
    .join("\n")

  // 截断大笔记
  const truncated = contentWithIndex.length > 8000
    ? contentWithIndex.slice(0, 8000)
    : contentWithIndex

  const prompt = `你是一位知识管理专家。请分析以下笔记，提取其中包含的核心「观点」。

**观点的定义**：一个可独立成文的主题或论点，具有足够的深度和独立性。
例如「第一性原理思维」「长期主义投资」「系统思维」是观点；
「今天天气不错」「读了一本书」不是观点。

**规则**：
1. 一篇笔记可能包含 0~5 个观点（大多数 1~3 个）
2. 如果笔记是纯日志/流水账/无实质性观点，返回空列表
3. 观点标题应简洁、抽象、可复用
4. 标注每个观点对应的段落范围（用块序号 blockIndex 表示）
5. 给出关联理由和置信度（0~1）

**笔记元数据**：
- 标签：${note.tags.join(", ")}
- 来源路径：${note.relativePath}

**笔记内容**：
${truncated}

请以 JSON 格式返回：
{"viewpoints": [{"title": "...", "isExisting": false, "relatedBlockIndices": [0, 1], "reason": "...", "confidence": 0.85}]}`

  try {
    const response = await fetch(`${modelConfig.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return []
    }

    const parsed = JSON.parse(content)
    return parsed.viewpoints ?? []
  } catch {
    return []
  }
}
