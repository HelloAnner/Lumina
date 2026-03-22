"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, BookUp, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Toast } from "@/components/ui/toast"

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
}

export function UploadPageClient() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [toast, setToast] = useState<string>("")

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
    if (data.toastMessage) {
      setToast(data.toastMessage)
    }
    setTimeout(() => {
      router.push("/library")
      router.refresh()
    }, 1600)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.12),transparent_26%),#0A0A0B] px-8 py-8">
      {toast ? (
        <Toast
          title={toast}
          description="文件已继续进入自动适配流程。"
          tone={toast.includes("未配置") ? "warning" : "success"}
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
                  上传一本 EPUB，剩下的交给系统。
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-secondary">
                  文件会直接写入 MinIO，元数据写入数据库。优先尝试大模型解析；如果你尚未配置模型，会自动降级到硬解析，并用 Toast 告知你。
                </p>
              </div>
            </div>

            <Card className="overflow-hidden border-white/10 bg-white/5 p-0 backdrop-blur">
              <div className="border-b border-white/10 px-6 py-5">
                <div className="text-lg font-medium">上传文件</div>
                <div className="mt-1 text-sm text-secondary">仅支持 EPUB / PDF，当前推荐 EPUB。</div>
              </div>
              <div className="p-6">
                <button
                  className="flex min-h-[320px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/10 via-transparent to-cyan-400/5 p-10 text-center transition hover:border-primary/50 hover:bg-primary/10"
                  onClick={() => inputRef.current?.click()}
                >
                  <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 p-5 text-primary">
                    <BookUp className="h-10 w-10" />
                  </div>
                  <div className="text-xl font-medium text-white">
                    {file ? file.name : "点击选择一本 EPUB"}
                  </div>
                  <div className="mt-3 max-w-md text-sm leading-6 text-secondary">
                    {file
                      ? `已选择 ${(file.size / 1024 / 1024).toFixed(2)} MB，点击下方开始导入。`
                      : "进入独立上传页后，你可以更专注地完成解析预览与确认，不再把流程堆在书架里。"}
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
                上传成功后，这里会展示系统为你提取出的书籍信息。
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {metaRows.length > 0 ? (
                metaRows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-4"
                  >
                    <div className="text-sm text-secondary">{label}</div>
                    <div className="max-w-[70%] text-right text-sm text-foreground">
                      {value}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-secondary">
                  尚未开始导入。完成上传后，这里会展示名称、作者、类型、标签以及解析模式。
                </div>
              )}
            </div>
            {result ? (
              <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/10 p-5">
                <div className="text-sm font-medium text-white">
                  解析方式：{result.parseMode === "llm" ? "大模型自动解析" : "自动硬解析"}
                </div>
                <p className="mt-2 text-sm leading-6 text-secondary">{result.item.synopsis}</p>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  )
}
