"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUp,
  BookOpen,
  BookUp,
  Check,
  FileText,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Upload,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { Badge } from "@/components/ui/badge"
import type { BookFormat, ReaderSection } from "@/src/server/store/types"

interface UploadResult {
  item: {
    id: string
    title: string
    author?: string
    format: string
    tags: string[]
    synopsis: string
  }
  parseMode: "llm" | "hard"
  toastMessage?: string
  previewSections?: ReaderSection[]
}

export function UploadPageClient() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [toast, setToast] = useState<string>("")
  const [dragOver, setDragOver] = useState(false)

  // 编辑模式
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editAuthor, setEditAuthor] = useState("")
  const [editFormat, setEditFormat] = useState<BookFormat>("EPUB")
  const [editTags, setEditTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && /\.(epub|pdf)$/i.test(dropped.name)) {
      setFile(dropped)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  async function handleSubmit() {
    if (!file) {
      return
    }
    setUploading(true)
    const formData = new FormData()
    formData.set("file", file)
    const response = await fetch("/api/books/upload", {
      method: "POST",
      body: formData
    })
    const data = (await response.json()) as UploadResult
    setUploading(false)
    if (!response.ok) {
      setToast(data?.toastMessage || "上传失败，请稍后重试。")
      return
    }
    setResult(data)
    setEditTitle(data.item.title)
    setEditAuthor(data.item.author || "")
    setEditFormat(data.item.format as BookFormat)
    setEditTags(data.item.tags)
    if (data.toastMessage) {
      setToast(data.toastMessage)
    }
  }

  async function handleSaveEdit() {
    if (!result) {
      return
    }
    const response = await fetch(`/api/books/${result.item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        author: editAuthor,
        format: editFormat,
        tags: editTags
      })
    })
    if (response.ok) {
      const { item } = await response.json()
      setResult({ ...result, item: { ...result.item, ...item } })
      setIsEditing(false)
      setToast("书籍信息已更新")
      setTimeout(() => {
        router.push("/library")
        router.refresh()
      }, 1200)
    } else {
      setToast("保存失败")
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !editTags.includes(newTag.trim())) {
      setEditTags([...editTags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag))
  }

  // 三态渲染
  const renderContent = () => {
    // 态三：解析完成
    if (result && !isEditing) {
      return (
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="h-6 w-6 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-white">导入成功</h2>

          <div className="w-[480px] overflow-hidden rounded-xl border border-border/50 bg-[#18181B]">
            {/* 书籍头部 */}
            <div className="flex items-center gap-3.5 px-5 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary/10">
                <BookOpen className="h-[22px] w-[22px] text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-white">
                  {result.item.title}
                </div>
                <div className="mt-0.5 text-[13px] text-muted">
                  {result.item.author || "未知作者"}
                </div>
              </div>
              <div className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1">
                <Sparkles className="h-3 w-3 text-primary/80" />
                <span className="text-[11px] font-semibold text-primary/80">
                  {result.parseMode === "llm" ? "AI" : "硬解析"}
                </span>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* 元数据 */}
            <div className="space-y-2.5 px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground/50">格式</span>
                <span className="text-[13px] font-medium text-muted-foreground">
                  {result.item.format}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground/50">标签</span>
                <div className="flex gap-1.5">
                  {result.item.tags.length > 0 ? (
                    result.item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-[#27272A] px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-muted-foreground">未生成</span>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2.5 px-5 py-3">
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-4 py-2 text-[13px] text-muted-foreground transition hover:bg-white/5"
              >
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </button>
              <Button size="sm" onClick={() => router.push(`/reader/${result.item.id}`)}>
                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                开始阅读
              </Button>
            </div>
          </div>
        </div>
      )
    }

    // 态三（编辑子态）
    if (result && isEditing) {
      return (
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-lg font-semibold text-white">编辑书籍信息</h2>
          <div className="w-[480px] space-y-4 rounded-xl border border-border/50 bg-[#18181B] p-5">
            <div>
              <label className="mb-1.5 block text-xs text-muted">书名</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted">作者</label>
              <Input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted">格式</label>
              <div className="flex gap-2">
                {(["EPUB", "PDF"] as BookFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setEditFormat(f)}
                    className={`rounded-lg px-4 py-2 text-sm transition-all ${
                      editFormat === f
                        ? "bg-primary text-white"
                        : "bg-white/5 text-secondary hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted">标签</label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="添加标签"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                />
                <Button variant="secondary" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {editTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {editTags.map((tag) => (
                    <Badge key={tag} className="flex items-center gap-1 pr-1">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 rounded-full p-0.5 hover:bg-white/10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit}>保存并返回</Button>
          </div>
        </div>
      )
    }

    // 态二：已选文件
    if (file) {
      return (
        <div className="flex flex-col items-center gap-7">
          <div className="flex w-[420px] items-center gap-3.5 rounded-xl border border-border/50 bg-[#18181B] px-5 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary/10">
              <FileText className="h-[22px] w-[22px] text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{file.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground/50">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="rounded-md p-1 text-muted-foreground/50 transition hover:bg-white/5 hover:text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在解析
                </>
              ) : (
                <>
                  <ArrowUp className="mr-1.5 h-4 w-4" />
                  开始导入
                </>
              )}
            </Button>
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-border/50 px-5 py-2.5 text-sm text-muted transition hover:bg-white/5 hover:text-foreground"
            >
              重新选择
            </button>
          </div>
        </div>
      )
    }

    // 态一：初始拖拽
    return (
      <div className="flex flex-col items-center gap-8">
        {/* 图标 */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-primary/15 to-primary/5 ring-1 ring-primary/20">
          <BookUp className="h-7 w-7 text-primary" />
        </div>

        {/* 文案 */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white">上传书籍</h2>
          <p className="mt-2 text-sm text-muted">拖拽文件到此处，或点击选择</p>
        </div>

        {/* 拖拽区 */}
        <button
          className={`flex h-[200px] w-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed transition ${
            dragOver
              ? "border-primary/50 bg-primary/5"
              : "border-border/50 hover:border-border hover:bg-white/[0.02]"
          }`}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <FileUp className="h-8 w-8 text-[#3F3F46]" />
          <span className="text-[13px] font-medium tracking-wider text-muted-foreground/50">
            EPUB / PDF
          </span>
          <span className="text-xs text-[#3F3F46]">文件大小不超过 200MB</span>
        </button>

        <Button onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" />
          选择文件
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {toast ? (
        <Toast
          title={toast}
          description={toast.includes("失败") ? "" : "文件已继续进入自动适配流程。"}
          tone={toast.includes("失败") || toast.includes("未配置") ? "warning" : "success"}
          onClose={() => setToast("")}
        />
      ) : null}

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".epub,.pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {renderContent()}
    </div>
  )
}
