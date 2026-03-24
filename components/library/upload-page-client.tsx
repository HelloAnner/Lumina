"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, BookUp, Loader2, Plus, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editAuthor, setEditAuthor] = useState("")
  const [editFormat, setEditFormat] = useState<BookFormat>("EPUB")
  const [editTags, setEditTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  const metaRows = useMemo(
    () =>
      result
        ? [
            ["名称", result.item.title],
            ["作者", result.item.author || "未知作者"],
            ["类型", result.item.format],
            ["标签", result.item.tags.join(" / ") || "未生成"]
          ]
        : [],
    [result]
  )
  const previewSections = result?.previewSections?.filter((section) => section.content.trim()) ?? []

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
    // 初始化编辑状态
    setEditTitle(data.item.title)
    setEditAuthor(data.item.author || "")
    setEditFormat(data.item.format as BookFormat)
    setEditTags(data.item.tags)
    if (data.toastMessage) {
      setToast(data.toastMessage)
    }
  }

  async function handleSaveEdit() {
    if (!result) return

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
      setResult({
        ...result,
        item: { ...result.item, ...item }
      })
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

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter((t) => t !== tagToRemove))
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.12),transparent_26%),#0A0A0B] px-8 py-8">
      {toast ? (
        <Toast
          title={toast}
          description={toast.includes("失败") ? "" : "文件已继续进入自动适配流程。"}
          tone={toast.includes("失败") || toast.includes("未配置") ? "warning" : "success"}
          onClose={() => setToast("")}
        />
      ) : null}
      <div className="mx-auto max-w-6xl">
        <button
          className="mb-8 inline-flex items-center gap-2 text-sm text-secondary transition hover:text-foreground"
          onClick={() => router.push("/library")}
        >
          <ArrowLeft className="h-4 w-4" />
          返回书库
        </button>

        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                智能导入
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-white">
                  上传一本书，剩下的交给系统。
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-secondary">
                  文件会直接写入 MinIO，元数据写入数据库。优先尝试大模型解析；如果你尚未配置模型，会自动降级到硬解析，并用 Toast 告知你。
                </p>
              </div>
            </div>

            <Card className="overflow-hidden border-white/10 bg-white/5 p-0 backdrop-blur">
              <div className="border-b border-white/10 px-6 py-5">
                <div className="text-lg font-medium">上传文件</div>
                <div className="mt-1 text-sm text-secondary">支持 EPUB / PDF 格式</div>
              </div>
              <div className="p-6">
                <button
                  className="flex min-h-[280px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/10 via-transparent to-cyan-400/5 p-10 text-center transition hover:border-primary/50 hover:bg-primary/10"
                  onClick={() => inputRef.current?.click()}
                >
                  <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 p-5 text-primary">
                    <BookUp className="h-10 w-10" />
                  </div>
                  <div className="text-xl font-medium text-white">
                    {file ? file.name : "点击选择文件"}
                  </div>
                  <div className="mt-3 max-w-md text-sm leading-6 text-secondary">
                    {file
                      ? `已选择 ${(file.size / 1024 / 1024).toFixed(2)} MB，点击下方开始导入。`
                      : "支持 EPUB、PDF 格式，系统会自动解析元数据"}
                  </div>
                </button>
                <input
                  ref={inputRef}
                  className="hidden"
                  type="file"
                  accept=".epub,.pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <div className="mt-6 flex justify-end">
                  <Button disabled={!file || uploading} onClick={handleSubmit}>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在上传与解析
                      </>
                    ) : (
                      "开始导入"
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <Card className="border-white/10 bg-black/30 p-6 backdrop-blur">
            <div className="space-y-2">
              <div className="text-lg font-medium text-white">解析预览</div>
              <div className="text-sm text-secondary">
                上传成功后，这里会直接展示系统提取的书籍信息和正文片段。
              </div>
            </div>

            {result && !isEditing ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-muted">书籍信息</span>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      编辑
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {metaRows.map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between">
                        <div className="text-sm text-muted">{label}</div>
                        <div className="max-w-[70%] text-right text-sm text-foreground">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5">
                  <div className="text-sm font-medium text-white">
                    解析方式：{result.parseMode === "llm" ? "大模型自动解析" : "自动硬解析"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-secondary">{result.item.synopsis}</p>
                </div>

                {previewSections.length > 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 text-sm font-medium text-white">已解析正文</div>
                    <div className="space-y-3">
                      {previewSections.slice(0, 2).map((section) => (
                        <div
                          key={section.id}
                          className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                        >
                          <div className="mb-2 text-xs text-muted">
                            {section.title || `第 ${section.pageIndex} 段`}
                          </div>
                          <div className="line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-secondary">
                            {section.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex justify-end gap-2 pt-2">
                  <Button onClick={() => router.push(`/reader/${result.item.id}`)}>
                    继续阅读
                  </Button>
                  <Button variant="secondary" onClick={() => router.push("/library")}>
                    返回书库
                  </Button>
                </div>
              </div>
            ) : result && isEditing ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-4 text-sm font-medium text-white">编辑书籍信息</div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs text-muted">书名</label>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="输入书名"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs text-muted">作者</label>
                      <Input
                        value={editAuthor}
                        onChange={(e) => setEditAuthor(e.target.value)}
                        placeholder="输入作者"
                      />
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
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setIsEditing(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSaveEdit}>保存并返回</Button>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-secondary">
                尚未开始导入。完成上传后，这里会展示名称、作者、类型、标签、解析模式和正文片段。
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
