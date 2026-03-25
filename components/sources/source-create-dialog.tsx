/**
 * 信息源创建 Dialog
 * 从内置渠道模板选择 → 填写参数 → 测试连接 → 创建
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
"use client"

import { useState, useMemo, useCallback } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  X,
  Zap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/src/lib/utils"
import type { ScoutChannel, ScoutCredential, ScoutSource } from "@/src/server/store/types"

interface Props {
  channels: ScoutChannel[]
  credentials: ScoutCredential[]
  onClose: () => void
  onCreated: (source: ScoutSource) => void
}

/** 将模板中的 {param} 替换为实际值 */
function resolveEndpoint(template: string, values: Record<string, string>): string {
  let result = template
  for (const [key, val] of Object.entries(values)) {
    result = result.replace(`{${key}}`, encodeURIComponent(val))
  }
  return result
}

const TAG_GROUPS: { label: string; tags: string[] }[] = [
  { label: "科技社区", tags: ["科技", "编程", "社区", "讨论"] },
  { label: "学术论文", tags: ["学术", "论文"] },
  { label: "社交媒体", tags: ["社交", "实时"] },
  { label: "中文资讯", tags: ["中文", "博客", "观点", "热点", "深度"] },
  { label: "通用", tags: ["通用"] }
]

export function SourceCreateDialog({ channels, credentials, onClose, onCreated }: Props) {
  const [step, setStep] = useState<"select" | "configure">("select")
  const [selectedChannel, setSelectedChannel] = useState<ScoutChannel | null>(null)
  const [name, setName] = useState("")
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [includeKeywords, setIncludeKeywords] = useState("")
  const [excludeKeywords, setExcludeKeywords] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; sampleTitles?: string[]; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const builtinChannels = useMemo(
    () => channels.filter((c) => c.origin === "builtin"),
    [channels]
  )

  /** 按标签分组 */
  const groupedChannels = useMemo(() => {
    return TAG_GROUPS.map((group) => ({
      ...group,
      channels: builtinChannels.filter((ch) =>
        ch.tags.some((t) => group.tags.includes(t))
      )
    })).filter((g) => g.channels.length > 0)
  }, [builtinChannels])

  const handleSelectChannel = useCallback((channel: ScoutChannel) => {
    setSelectedChannel(channel)
    setName(channel.name)
    setParamValues({})
    setTestResult(null)
    setStep("configure")
  }, [])

  const resolvedEndpoint = useMemo(() => {
    if (!selectedChannel) return ""
    return resolveEndpoint(selectedChannel.endpointTemplate, paramValues)
  }, [selectedChannel, paramValues])

  const canTest = useMemo(() => {
    if (!selectedChannel) return false
    const requiredParams = selectedChannel.params.filter((p) => p.required)
    return requiredParams.every((p) => paramValues[p.name]?.trim())
  }, [selectedChannel, paramValues])

  const handleTest = useCallback(async () => {
    if (!selectedChannel || !canTest) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/scout/sources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: selectedChannel.protocol,
          endpoint: resolvedEndpoint
        })
      })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, error: "请求失败" })
    } finally {
      setTesting(false)
    }
  }, [selectedChannel, canTest, resolvedEndpoint])

  const handleCreate = useCallback(async () => {
    if (!selectedChannel || !name.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/scout/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          channelId: selectedChannel.id,
          protocol: selectedChannel.protocol,
          endpoint: resolvedEndpoint,
          paramValues,
          status: "active",
          includeKeywords: includeKeywords ? includeKeywords.split(",").map((s) => s.trim()).filter(Boolean) : [],
          excludeKeywords: excludeKeywords ? excludeKeywords.split(",").map((s) => s.trim()).filter(Boolean) : []
        })
      })
      if (res.ok) {
        const { item } = await res.json()
        onCreated(item)
      }
    } catch {
      // handled by parent
    } finally {
      setSaving(false)
    }
  }, [selectedChannel, name, resolvedEndpoint, paramValues, includeKeywords, excludeKeywords, onCreated])

  const needsCredential = selectedChannel?.requiresCredential
  const hasCredential = needsCredential
    ? credentials.some((c) => c.type === selectedChannel?.credentialType)
    : true

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        {/* 标题 */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === "configure" && (
              <button
                onClick={() => { setStep("select"); setSelectedChannel(null); setTestResult(null) }}
                className="text-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h3 className="text-[16px] font-medium text-foreground">
              {step === "select" ? "选择渠道模板" : `配置 — ${selectedChannel?.name}`}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 第一步：选择模板 */}
        {step === "select" && (
          <div className="space-y-5">
            {groupedChannels.map((group) => (
              <div key={group.label}>
                <span className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-secondary">
                  {group.label}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {group.channels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => handleSelectChannel(ch)}
                      className="flex flex-col gap-1 rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-primary/30 hover:bg-overlay/40"
                    >
                      <span className="text-[13px] font-medium text-foreground">{ch.name}</span>
                      <span className="text-[11px] text-secondary line-clamp-2">{ch.description}</span>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                        <span>{ch.protocol}</span>
                        {ch.requiresCredential && (
                          <span className="text-amber-500">需要凭证</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 第二步：配置参数 */}
        {step === "configure" && selectedChannel && (
          <div className="space-y-4">
            {/* 名称 */}
            <div>
              <label className="mb-1 block text-[12px] font-medium text-secondary">信息源名称</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="为此信息源命名" />
            </div>

            {/* 渠道参数 */}
            {selectedChannel.params.map((param) => (
              <div key={param.name}>
                <label className="mb-1 block text-[12px] font-medium text-secondary">
                  {param.label}
                  {param.required && <span className="ml-0.5 text-red-400">*</span>}
                </label>
                {param.inputType === "select" && param.options ? (
                  <select
                    value={paramValues[param.name] ?? ""}
                    onChange={(e) => setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-border bg-elevated px-4 text-sm text-foreground outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">请选择</option>
                    {param.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={paramValues[param.name] ?? ""}
                    onChange={(e) => setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))}
                    placeholder={param.placeholder}
                  />
                )}
              </div>
            ))}

            {/* 凭证警告 */}
            {needsCredential && !hasCredential && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] text-amber-500">
                此渠道需要 {selectedChannel.credentialType} 凭证。请先在设置中添加。
              </div>
            )}

            {/* 解析后的 endpoint 预览 */}
            {canTest && (
              <div>
                <label className="mb-1 block text-[12px] font-medium text-secondary">端点地址</label>
                <p className="rounded-lg bg-overlay/40 px-3 py-2 text-[12px] text-muted break-all">
                  {resolvedEndpoint}
                </p>
              </div>
            )}

            {/* 关键词过滤 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-secondary">包含关键词</label>
                <Input
                  value={includeKeywords}
                  onChange={(e) => setIncludeKeywords(e.target.value)}
                  placeholder="逗号分隔（可选）"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-secondary">排除关键词</label>
                <Input
                  value={excludeKeywords}
                  onChange={(e) => setExcludeKeywords(e.target.value)}
                  placeholder="逗号分隔（可选）"
                />
              </div>
            </div>

            {/* 测试连接 */}
            <div className="rounded-xl border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-foreground">测试连接</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleTest}
                  disabled={!canTest || testing}
                  className="gap-1.5"
                >
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  {testing ? "测试中..." : "测试"}
                </Button>
              </div>
              {testResult && (
                <div className="mt-3">
                  {testResult.ok ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[12px] text-green-500">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        连接成功
                      </div>
                      {testResult.sampleTitles?.map((title, i) => (
                        <p key={i} className="text-[12px] text-muted line-clamp-1 pl-5">{title}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-red-400">{testResult.error}</p>
                  )}
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!name.trim() || !canTest || saving || (needsCredential && !hasCredential)}
              >
                {saving ? "创建中..." : "创建信息源"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
