/**
 * 设置 - 搜寻渠道 Tab
 * 同步配置、全局参数、API 凭证、渠道列表
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Globe,
  KeyRound,
  Rss,
  Settings2,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import type { ScoutConfig, ScoutCredential } from "@/src/server/store/types"

/** 同步周期预设选项（分钟） */
const SYNC_INTERVAL_OPTIONS = [
  { label: "禁用自动同步", value: 0 },
  { label: "每 15 分钟", value: 15 },
  { label: "每 30 分钟", value: 30 },
  { label: "每 60 分钟", value: 60 },
  { label: "每 2 小时", value: 120 },
  { label: "每 6 小时", value: 360 },
  { label: "每 12 小时", value: 720 },
  { label: "每 24 小时", value: 1440 }
]

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
    syncIntervalMinutes: 60,
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
          <p className="mt-1 text-sm text-muted">配置信息源自动同步周期、全局参数和 API 凭证</p>
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
        <p className="mt-1 text-sm text-muted">配置信息源自动同步周期、全局参数和 API 凭证</p>
      </div>

      {/* 同步配置 */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center border-b border-border/40 px-5 py-3.5">
          <span className="text-sm font-medium">同步配置</span>
        </div>
        <div className="divide-y divide-border/40">
          {/* 启用自动同步 */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-[14px] font-medium text-foreground">启用自动同步</p>
              <p className="text-[12px] text-muted">开启后按设定周期自动抓取信息源</p>
            </div>
            <button
              onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
              className={`relative h-[22px] w-[44px] rounded-full transition-colors ${
                config.enabled ? "bg-primary" : "bg-overlay"
              }`}
            >
              <span
                className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-transform ${
                  config.enabled ? "translate-x-[24px]" : "translate-x-[2px]"
                }`}
              />
            </button>
          </div>

          {/* 同步周期 */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-[14px] font-medium text-foreground">同步周期</p>
              <p className="text-[12px] text-muted">信息源数据拉取的间隔时间</p>
            </div>
            <select
              value={config.syncIntervalMinutes ?? 60}
              onChange={(e) => setConfig((c) => ({ ...c, syncIntervalMinutes: Number(e.target.value) }))}
              className="h-9 rounded-lg border border-border/60 bg-overlay/40 px-3 text-[13px] text-foreground outline-none"
            >
              {SYNC_INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 条目保留天数 */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-[14px] font-medium text-foreground">条目保留天数</p>
              <p className="text-[12px] text-muted">超过保留期的历史条目将自动清理</p>
            </div>
            <Input
              type="number"
              min={1}
              className="h-9 w-20 text-center"
              value={config.entryRetentionDays ?? 30}
              onChange={(e) => setConfig((c) => ({ ...c, entryRetentionDays: Number(e.target.value) }))}
            />
          </div>
        </div>
      </Card>

      {/* 全局参数 */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center border-b border-border/40 px-5 py-3.5">
          <Settings2 className="mr-2 h-4 w-4 text-muted" />
          <span className="text-sm font-medium">全局参数</span>
        </div>
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[14px] font-medium text-foreground">默认相关度阈值</p>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-muted">{Math.round((config.defaultRelevanceThreshold ?? 0.6) * 100)}%</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={config.defaultRelevanceThreshold ?? 0.6}
                onChange={(e) => setConfig((c) => ({ ...c, defaultRelevanceThreshold: Number(e.target.value) }))}
                className="w-32"
              />
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[14px] font-medium text-foreground">每日 Patch 上限</p>
            <Input
              type="number"
              min={1}
              className="h-9 w-20 text-center"
              value={config.dailyPatchLimit ?? 50}
              onChange={(e) => setConfig((c) => ({ ...c, dailyPatchLimit: Number(e.target.value) }))}
            />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-[14px] font-medium text-foreground">RSSHub 地址</p>
              <p className="text-[12px] text-muted">自定义 RSSHub 实例（可选）</p>
            </div>
            <Input
              placeholder="https://rsshub.app"
              className="h-9 w-60"
              value={config.rsshubBaseUrl ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, rsshubBaseUrl: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button size="sm" onClick={saveConfig}>保存配置</Button>
      </div>

      {/* API 凭证 */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted" />
          <span className="text-sm font-medium">API 凭证</span>
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

      {/* 自定义渠道 */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted" />
          <span className="text-sm font-medium">自定义渠道 ({userChannels.length})</span>
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
