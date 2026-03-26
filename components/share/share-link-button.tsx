/**
 * 阅读分享按钮
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Link2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/src/lib/utils"
import type { ShareDurationOption, ShareResourceType } from "@/src/server/store/types"

const DURATION_OPTIONS: Array<{
  value: ShareDurationOption
  label: string
  desc: string
}> = [
  { value: "24h", label: "24 小时", desc: "适合临时讨论" },
  { value: "7d", label: "7 天", desc: "适合短期协作" },
  { value: "30d", label: "30 天", desc: "适合持续分享" },
  { value: "never", label: "永久有效", desc: "长期公开访问" }
]

export function ShareLinkButton({
  resourceType,
  resourceId,
  onToast
}: {
  resourceType: ShareResourceType
  resourceId: string
  onToast: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [loadingOption, setLoadingOption] = useState<ShareDurationOption | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [open])

  async function createAndCopy(duration: ShareDurationOption) {
    setLoadingOption(duration)
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resourceType,
          resourceId,
          duration
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || typeof data.shareUrl !== "string") {
        onToast(data.error || "分享链接生成失败")
        return
      }
      await navigator.clipboard.writeText(data.shareUrl)
      onToast("分享链接已复制")
      setOpen(false)
    } catch {
      onToast("复制失败，请稍后重试")
    } finally {
      setLoadingOption(null)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md text-muted transition",
          "hover:bg-overlay hover:text-foreground"
        )}
        onClick={() => setOpen((current) => !current)}
        title="分享"
      >
        <Share2 className="h-4 w-4" />
      </button>

      {open ? (
        <Card className="absolute right-0 top-10 z-40 w-[240px] border-border/70 bg-surface/95 p-2 shadow-2xl backdrop-blur-md hover:border-border/70 hover:shadow-2xl">
          <div className="px-2 pb-2 pt-1">
            <div className="text-xs font-medium text-foreground">复制分享链接</div>
            <div className="mt-1 text-[11px] leading-5 text-muted">
              选择有效期后立即生成并复制，访问者会直接进入当前阅读页。
            </div>
          </div>
          <div className="space-y-1">
            {DURATION_OPTIONS.map((option) => {
              const loading = loadingOption === option.value
              return (
                <Button
                  key={option.value}
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-between rounded-lg px-2.5 py-2 text-left"
                  disabled={Boolean(loadingOption)}
                  onClick={() => {
                    void createAndCopy(option.value)
                  }}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xs font-medium text-foreground">{option.label}</span>
                    <span className="text-[11px] text-muted">{option.desc}</span>
                  </span>
                  <Link2 className={cn("h-3.5 w-3.5 shrink-0", loading && "animate-pulse")} />
                </Button>
              )
            })}
          </div>
          <div className="flex items-center gap-1 px-2 py-2 text-[11px] text-muted">
            <Check className="h-3 w-3" />
            创建后自动写入剪贴板
          </div>
        </Card>
      ) : null}
    </div>
  )
}
