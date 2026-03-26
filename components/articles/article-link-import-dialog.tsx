/**
 * 手动添加文章链接弹窗
 * 支持粘贴 URL 后回车解析并加入文章列表
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/26
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Link2, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ScoutArticle } from "@/src/server/store/types"

interface Props {
  onClose: () => void
  onImported: (payload: { status: "created" | "existing"; item: ScoutArticle }) => void | Promise<void>
}

export function ArticleLinkImportDialog({ onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!url.trim()) {
      setError("请输入文章链接")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/articles/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() })
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "文章解析失败")
        return
      }
      await onImported(data)
    } catch {
      setError("网络错误，请稍后再试")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-[560px] rounded-[24px] border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-[18px] font-semibold text-foreground">添加文章链接</h2>
            <p className="text-[12px] leading-6 text-secondary">
              粘贴一篇值得保存的文章，回车后开始解析并加入文章库。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-overlay/70 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2 rounded-[14px] border border-primary/40 bg-elevated px-3">
            <Link2 className="h-4 w-4 text-primary" />
            <Input
              ref={inputRef}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.example.com/article"
              className="h-12 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="rounded-[18px] border border-border/70 bg-elevated/70 px-4 py-3">
            <p className="text-[12px] font-medium text-foreground">回车即可解析</p>
            <p className="mt-1 text-[12px] leading-6 text-secondary">
              支持单篇网页文章链接；若链接已存在，会直接提示并避免重复创建。
            </p>
          </div>

          {error ? <p className="text-[12px] text-error">{error}</p> : null}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-[11px] text-muted">支持手动补充你想保留的好文章</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "解析中..." : "开始解析"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
