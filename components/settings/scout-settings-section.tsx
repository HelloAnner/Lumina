/**
 * 设置 - 搜寻渠道 Tab
 * API 凭证管理、全局配置、自定义渠道、内置渠道预览
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Plus,
  Rss,
  Settings2,
  Trash2,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { cn } from "@/src/lib/utils"
import type { ScoutChannel, ScoutConfig, ScoutCredential } from "@/src/server/store/types"

interface ChannelDisplay {
  id: string
  name: string
  description: string
  protocol: string
  origin: string
  tags: string[]
}

export function ScoutSettingsSection() {
  const [config, setConfig] = useState<Partial<ScoutConfig>>({
    enabled: false,
    defaultRelevanceThreshold: 0.6,
    dailyPatchLimit: 50,
    entryRetentionDays: 30
  })
  const [credentials, setCredentials] = useState<ScoutCredential[]>([])
  const [channels, setChannels] = useState<ChannelDisplay[]>([])
  const [toast, setToast] = useState<{ title: string; tone: "success" | "error" } | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/scout/config").then((r) => r.json()),
      fetch("/api/scout/credentials").then((r) => r.json()),
      fetch("/api/scout/channels").then((r) => r.json())
    ]).then(([configRes, credRes, chanRes]) => {
      setConfig(configRes.item)
      setCredentials(credRes.items)
      setChannels(chanRes.items)
      setLoaded(true)
    })
  }, [])

  const saveConfig = useCallback(async () => {
    try {
      await fetch("/api/scout/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      })
      setToast({ title: "配置已保存", tone: "success" })
    } catch {
      setToast({ title: "保存失败", tone: "error" })
    }
  }, [config])

  const deleteCredential = useCallback(async (id: string) => {
    await fetch(`/api/scout/credentials/${id}`, { method: "DELETE" })
    setCredentials((prev) => prev.filter((c) => c.id !== id))
  }, [])

  if (!loaded) {
    return (
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-xl font-semibold">搜寻渠道</h1>
          <p className="mt-1 text-sm text-muted">配置信息源渠道、API 凭证和全局参数</p>
        </div>
        <div className="text-sm text-muted">加载中...</div>
      </div>
    )
  }

  const builtinChannels = channels.filter((c) => c.origin === "builtin")
  const userChannels = channels.filter((c) => c.origin === "user")

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold">搜寻渠道</h1>
        <p className="mt-1 text-sm text-muted">配置信息源渠道、API 凭证和全局参数</p>
      </div>

      {/* API 凭证 */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted" />
            <span className="text-sm font-medium">API 凭证</span>
          </div>
        </div>
        {credentials.length === 0 ? (
          <p className="text-[13px] text-muted">暂无凭证。部分渠道（如 X/Twitter）需要 API 凭证才能使用。</p>
        ) : (
          <div className="space-y-2">
            {credentials.map((cred) => (
              <div key={cred.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{cred.name}</p>
                  <p className="text-[11px] text-muted">{cred.type} · {cred.verified ? "已验证" : "未验证"}</p>
                </div>
                <button
                  onClick={() => deleteCredential(cred.id)}
                  className="text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 全局配置 */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted" />
          <span className="text-sm font-medium">全局配置</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-muted">默认相关度阈值</label>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={config.defaultRelevanceThreshold ?? 0.6}
              onChange={(e) => setConfig((c) => ({ ...c, defaultRelevanceThreshold: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">每日 Patch 上限</label>
            <Input
              type="number"
              min={1}
              value={config.dailyPatchLimit ?? 50}
              onChange={(e) => setConfig((c) => ({ ...c, dailyPatchLimit: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">条目保留天数</label>
            <Input
              type="number"
              min={1}
              value={config.entryRetentionDays ?? 30}
              onChange={(e) => setConfig((c) => ({ ...c, entryRetentionDays: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">RSSHub 地址（可选）</label>
            <Input
              placeholder="https://rsshub.app"
              value={config.rsshubBaseUrl ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, rsshubBaseUrl: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveConfig}>保存配置</Button>
        </div>
      </Card>

      {/* 自定义渠道 */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted" />
            <span className="text-sm font-medium">自定义渠道 ({userChannels.length})</span>
          </div>
        </div>
        {userChannels.length === 0 ? (
          <p className="text-[13px] text-muted">可在此添加自定义渠道模板。</p>
        ) : (
          <div className="space-y-2">
            {userChannels.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{ch.name}</p>
                  <p className="text-[11px] text-muted">{ch.protocol} · {ch.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 内置渠道列表 */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Rss className="h-4 w-4 text-muted" />
          <span className="text-sm font-medium">内置渠道 ({builtinChannels.length})</span>
          <span className="text-[11px] text-muted">（只读）</span>
        </div>
        <div className="space-y-1.5">
          {builtinChannels.map((ch) => (
            <div key={ch.id} className="flex items-center justify-between rounded-lg bg-overlay/30 px-3 py-2">
              <div>
                <p className="text-[13px] text-foreground">{ch.name}</p>
                <p className="text-[11px] text-muted">{ch.protocol} · {ch.description}</p>
              </div>
              <div className="flex gap-1">
                {ch.tags.map((tag) => (
                  <span key={tag} className="rounded bg-overlay/60 px-1.5 py-0.5 text-[10px] text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {toast && <Toast title={toast.title} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}
