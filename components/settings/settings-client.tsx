"use client"

import React, { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FileText,
  HardDrive,
  KeyRound,
  Languages,
  Layers,
  LayoutGrid,
  Moon,
  Monitor,
  Palette,
  Pencil,
  PenLine,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  User as UserIcon,
  Volume2,
  X,
  Zap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useTheme, type AppTheme } from "@/components/theme-provider"
import {
  buildModelTestToast,
  type SettingsToastState
} from "@/components/settings/settings-client-utils"
import { cn } from "@/src/lib/utils"
import type {
  ModelBinding,
  ModelCategory,
  ModelConfig,
  TranslationDisplayMode,
  ReaderSettings,
  User
} from "@/src/server/store/types"

// ————— 类型 & 常量 —————

type SectionKey =
  | "model"
  | "scene"
  | "embedding"
  | "sync"
  | "account"
  | "reader"
  | "appearance"

const primaryNav: { key: SectionKey; label: string; icon: LucideIcon }[] = [
  { key: "model", label: "模型配置", icon: Cpu },
  { key: "scene", label: "场景配置", icon: LayoutGrid },
  { key: "embedding", label: "Embedding", icon: Layers },
  { key: "sync", label: "同步与存储", icon: Timer },
  { key: "account", label: "账户", icon: UserIcon }
]

const secondaryNav: { key: SectionKey; label: string; icon: LucideIcon }[] = [
  { key: "reader", label: "阅读", icon: BookOpen },
  { key: "appearance", label: "外观", icon: Palette }
]

type SceneFeature = {
  key: ModelBinding["feature"]
  label: string
  desc: string
  icon: LucideIcon
  category: ModelCategory
}

const sceneFeatures: SceneFeature[] = [
  { key: "instant_explain", label: "即时解释", desc: "阅读时即时解释选中文本", icon: Zap, category: "language" },
  { key: "section_translate", label: "翻译", desc: "文本翻译与语言转换", icon: Languages, category: "language" },
  { key: "article_generate", label: "文章生成", desc: "根据主题或提纲生成完整文章", icon: PenLine, category: "language" },
  { key: "aggregation_analyze", label: "摘要提取", desc: "自动提炼内容核心摘要", icon: FileText, category: "language" },
  { key: "voice_read", label: "语音朗读", desc: "将文本转换为语音播放", icon: Volume2, category: "speech" },
  { key: "embedding_index", label: "索引构建", desc: "从内容中提炼知识向量索引", icon: Sparkles, category: "embedding" }
]

const fontSizeOptions = [14, 16, 18, 20, 22] as const
const lineHeightOptions = [
  { value: 1.5, label: "紧凑" },
  { value: 1.6, label: "舒适" },
  { value: 1.75, label: "宽松" },
  { value: 2, label: "舒展" }
] as const
const fontFamilyOptions = [
  { value: "system", label: "系统字体" },
  { value: "serif", label: "衬线字体" },
  { value: "sans", label: "无衬线字体" }
] as const
const readerThemeOptions = [
  { value: "day", label: "日间", icon: Sun },
  { value: "sepia", label: "暖色", icon: Palette },
  { value: "night", label: "夜间", icon: Moon }
] as const
const translationViewOptions: { value: TranslationDisplayMode; label: string; desc: string }[] = [
  { value: "original", label: "原文优先", desc: "默认展示原文，手动切到译文" },
  { value: "translation", label: "译文优先", desc: "打开阅读器后优先展示译文" }
]

// ————— 工具函数 —————

function inferProvider(baseUrl: string): string {
  if (!baseUrl) return "—"
  if (baseUrl.includes("openai.com")) return "OpenAI"
  if (baseUrl.includes("anthropic.com")) return "Anthropic"
  if (baseUrl.includes("generativelanguage") || baseUrl.includes("googleapis.com")) return "Google"
  if (baseUrl.includes("azure")) return "Azure"
  if (baseUrl.includes("deepseek")) return "DeepSeek"
  if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") || baseUrl.includes("ollama")) {
    return "本地"
  }
  try {
    return new URL(baseUrl).hostname.replace(/^www\./, "")
  } catch {
    return baseUrl
  }
}

function inferModelType(model: ModelConfig): string {
  if (model.category === "speech") return "语音"
  const name = model.modelName.toLowerCase()
  if (name.includes("mini") || name.includes("small") || name.includes("haiku") || name.includes("flash")) {
    return "轻量"
  }
  if (model.baseUrl.includes("localhost") || model.baseUrl.includes("127.0.0.1")) return "本地"
  return "通用"
}

// ————— Toggle 组件 —————

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className={cn(
        "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        value ? "bg-primary" : "bg-border"
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          value ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

// ————— 模型弹窗 —————

interface ModelFormData {
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
}

interface ModelDialogProps {
  title: string
  initial?: Partial<ModelFormData>
  category: ModelCategory
  saving: boolean
  onClose: () => void
  onSave: (data: ModelFormData) => void
  /** 返回测试结果，latency 单位 ms */
  onTest: (data: ModelFormData) => Promise<{ ok: boolean; error?: string; latency?: number }>
}

type ProviderPreset = {
  label: string
  baseUrl: string
  modelPlaceholder: string
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { label: "OpenAI",    baseUrl: "https://api.openai.com/v1",                         modelPlaceholder: "gpt-4o" },
  { label: "Anthropic", baseUrl: "https://api.anthropic.com/v1",                      modelPlaceholder: "claude-sonnet-4-6" },
  { label: "Google",    baseUrl: "https://generativelanguage.googleapis.com/v1beta",  modelPlaceholder: "gemini-2.0-flash" },
  { label: "DeepSeek",  baseUrl: "https://api.deepseek.com/v1",                       modelPlaceholder: "deepseek-chat" },
  { label: "本地",       baseUrl: "http://localhost:11434/v1",                         modelPlaceholder: "llama3" },
  { label: "自定义",     baseUrl: "",                                                  modelPlaceholder: "" },
]

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; latency: number }
  | { status: "error"; message: string }

function ModelDialog({
  title,
  initial,
  category,
  saving,
  onClose,
  onSave,
  onTest
}: ModelDialogProps) {
  const [form, setForm] = useState<ModelFormData>({
    name: initial?.name ?? "",
    baseUrl: initial?.baseUrl ?? "",
    apiKey: "",
    modelName: initial?.modelName ?? ""
  })
  const [autoFilledUrl, setAutoFilledUrl] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState<TestState>({ status: "idle" })

  const defaultPlaceholder: Record<ModelCategory, string> = {
    language: "gpt-4o",
    speech: "tts-1",
    embedding: "text-embedding-3-small"
  }

  function applyPreset(preset: ProviderPreset) {
    setForm((c) => ({
      ...c,
      baseUrl: preset.baseUrl,
      modelName: c.modelName || preset.modelPlaceholder
    }))
    setAutoFilledUrl(!!preset.baseUrl)
    setTestState({ status: "idle" })
  }

  async function handleTest() {
    setTestState({ status: "testing" })
    const t0 = Date.now()
    const result = await onTest(form)
    const latency = Date.now() - t0
    if (result.ok) {
      setTestState({ status: "success", latency })
    } else {
      setTestState({ status: "error", message: result.error?.trim() || "请检查配置" })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[560px] rounded-2xl border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-200">

        {/* 头部 */}
        <div className="flex h-[60px] items-center justify-between border-b border-border/60 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Cpu className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[15px] font-semibold">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-overlay hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 提供商快选 */}
        <div className="border-b border-border/40 px-5 py-3.5">
          <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-muted">快速选择提供商</div>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_PRESETS.map((preset) => {
              const active = form.baseUrl === preset.baseUrl && preset.baseUrl !== ""
              return (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "h-7 rounded-md px-3 text-xs font-medium transition-all",
                    active
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "bg-elevated text-secondary hover:bg-overlay hover:text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 表单区域 */}
        <div className="space-y-4 px-5 py-5">
          {/* 显示名称 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-secondary">显示名称</label>
            <Input
              placeholder="例如：GPT-4o"
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            />
          </div>

          {/* 接入地址 + 模型名称 两列 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-medium text-secondary">接入地址</span>
                {autoFilledUrl && (
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                    <Check className="h-2.5 w-2.5" />
                    已自动填充
                  </span>
                )}
              </div>
              <Input
                placeholder="https://api.openai.com/v1"
                value={form.baseUrl}
                onChange={(e) => {
                  setAutoFilledUrl(false)
                  setTestState({ status: "idle" })
                  setForm((c) => ({ ...c, baseUrl: e.target.value }))
                }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-secondary">模型名称</label>
              <Input
                placeholder={defaultPlaceholder[category]}
                value={form.modelName}
                onChange={(e) => setForm((c) => ({ ...c, modelName: e.target.value }))}
              />
            </div>
          </div>

          {/* API Key */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-secondary">API Key</label>
              {initial && (
                <span className="text-[11px] text-muted">留空则保留现有密钥</span>
              )}
            </div>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={initial ? "••••••••••••••••" : "请输入 API Key"}
                value={form.apiKey}
                onChange={(e) => setForm((c) => ({ ...c, apiKey: e.target.value }))}
                autoComplete="off"
                spellCheck={false}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center gap-2 border-t border-border/60 px-5 py-3.5">
          {/* 测试按钮 */}
          <button
            onClick={handleTest}
            disabled={testState.status === "testing" || !form.baseUrl || !form.modelName}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-elevated px-3 text-xs font-medium text-secondary transition-colors hover:bg-overlay hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Zap className="h-3.5 w-3.5" />
            {testState.status === "testing" ? "测试中…" : "测试连接"}
          </button>

          {/* 内联测试结果 */}
          {testState.status === "success" && (
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              连接成功&nbsp;&nbsp;·&nbsp;&nbsp;{testState.latency}ms
            </span>
          )}
          {testState.status === "error" && (
            <span className="flex max-w-[200px] items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              <span className="truncate">{testState.message}</span>
            </span>
          )}

          <div className="flex-1" />
          <button
            onClick={onClose}
            className="h-8 rounded-lg px-3.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            取消
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name || !form.modelName}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ————— 主组件 —————

export function SettingsClient({
  user,
  modelConfigs,
  modelBindings,
  readerSettings
}: {
  user: User
  modelConfigs: ModelConfig[]
  modelBindings: ModelBinding[]
  readerSettings?: ReaderSettings
}) {
  const router = useRouter()
  const { theme: appTheme, setTheme: setAppTheme } = useTheme()
  const [activeSection, setActiveSection] = useState<SectionKey>("model")
  const [toast, setToast] = useState<SettingsToastState | null>(null)

  // 模型操作状态
  const [testResults, setTestResults] = useState<Record<string, "ok" | "error" | "testing">>({})
  const [dialogConfig, setDialogConfig] = useState<{
    mode: "add" | "edit"
    category: ModelCategory
    model?: ModelConfig
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // 同步设置
  const [schedule, setSchedule] = useState(user.aggregateSchedule)
  const [syncFreq, setSyncFreq] = useState<"daily" | "weekly">(
    user.aggregateSchedule !== "manual" ? user.aggregateSchedule : "daily"
  )
  const [savingSchedule, setSavingSchedule] = useState(false)
  const isAutoSync = schedule !== "manual"

  // 阅读设置
  const [readerForm, setReaderForm] = useState({
    fontSize: readerSettings?.fontSize ?? 16,
    lineHeight: readerSettings?.lineHeight ?? 1.75,
    fontFamily: readerSettings?.fontFamily ?? "serif",
    theme: readerSettings?.theme ?? "night",
    navigationMode: readerSettings?.navigationMode ?? "horizontal",
    translationView: (readerSettings?.translationView ?? "original") as TranslationDisplayMode
  })
  const [savingReader, setSavingReader] = useState(false)

  // 账户设置
  const [profileName, setProfileName] = useState(user.name)
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")

  const showToast = useCallback(
    (message: string | SettingsToastState) => {
      if (typeof message === "string") {
        setToast({ title: message })
        return
      }
      setToast(message)
    },
    []
  )

  const refreshAndShow = useCallback(
    async (msg: string, resp: Response) => {
      if (resp.ok) {
        showToast(msg)
        router.refresh()
      } else {
        const data = await resp.json().catch(() => ({}))
        showToast(data.error ?? `${msg}失败`)
      }
    },
    [router, showToast]
  )

  // ————— 模型操作 —————

  async function handleSaveModel(form: ModelFormData) {
    if (!form.name || !form.modelName) {
      showToast("请填写名称和模型名")
      return
    }
    setSaving(true)
    const isEdit = dialogConfig?.mode === "edit"
    const url = isEdit
      ? `/api/settings/models/${dialogConfig?.model?.id}`
      : "/api/settings/models"
    const resp = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, category: dialogConfig?.category ?? "language" })
    })
    setSaving(false)
    if (resp.ok) setDialogConfig(null)
    await refreshAndShow(isEdit ? "模型已更新" : "模型已添加", resp)
  }

  async function handleTestInDialog(form: ModelFormData): Promise<{ ok: boolean; error?: string }> {
    const resp = await fetch("/api/settings/models/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, category: dialogConfig?.category ?? "language" })
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, error: data.error }
  }

  async function handleTestByID(modelId: string) {
    setTestResults((prev) => ({ ...prev, [modelId]: "testing" }))
    const resp = await fetch(`/api/settings/models/${modelId}/test`, { method: "POST" })
    setTestResults((prev) => ({ ...prev, [modelId]: resp.ok ? "ok" : "error" }))
    const data = await resp.json().catch(() => ({}))
    showToast(buildModelTestToast(resp.ok, data))
  }

  async function handleDeleteModel() {
    if (!deleteTarget) return
    const resp = await fetch(`/api/settings/models/${deleteTarget}`, { method: "DELETE" })
    setDeleteTarget(null)
    await refreshAndShow("模型已删除", resp)
  }

  async function saveBinding(feature: ModelBinding["feature"], modelId: string) {
    const resp = await fetch("/api/settings/model-bindings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feature, modelId })
    })
    await refreshAndShow("配置已保存", resp)
  }

  // ————— 同步操作 —————

  async function persistSchedule(newSchedule: string) {
    setSavingSchedule(true)
    const resp = await fetch("/api/settings/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aggregateSchedule: newSchedule })
    })
    setSavingSchedule(false)
    if (!resp.ok) showToast("同步配置保存失败")
  }

  function handleAutoSyncToggle() {
    const next = isAutoSync ? "manual" : syncFreq
    setSchedule(next)
    persistSchedule(next)
  }

  function handleFreqChange(freq: "daily" | "weekly") {
    setSyncFreq(freq)
    setSchedule(freq)
    persistSchedule(freq)
  }

  // ————— 阅读操作 —————

  async function saveReaderSettings() {
    setSavingReader(true)
    const resp = await fetch("/api/settings/reader", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(readerForm)
    })
    setSavingReader(false)
    await refreshAndShow("阅读设置已保存", resp)
  }

  // ————— 账户操作 —————

  async function saveProfile() {
    const resp = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: profileName })
    })
    await refreshAndShow("账户信息已保存", resp)
  }

  async function changePassword() {
    if (!currentPassword || !nextPassword) {
      showToast("请填写完整密码信息")
      return
    }
    const resp = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, nextPassword })
    })
    if (resp.ok) {
      setCurrentPassword("")
      setNextPassword("")
    }
    showToast(resp.ok ? "密码修改成功" : "密码修改失败")
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  async function deleteAccount() {
    const resp = await fetch("/api/account", { method: "DELETE" })
    if (resp.ok) {
      await logout()
      return
    }
    showToast("账户注销失败")
  }

  // ————— 分组数据 —————

  const langModels = modelConfigs.filter(
    (m) => m.category === "language" || m.category === "speech"
  )
  const embeddingModel = modelConfigs.find((m) => m.category === "embedding")

  // ————— 渲染 —————

  return (
    <div className="grid min-h-screen grid-cols-[200px_minmax(0,1fr)] bg-base">
      {toast ? (
        <Toast
          title={toast.title}
          description={toast.description}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}

      {/* 确认删除弹窗 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除模型"
        description="确认删除此模型？相关功能绑定也将一并移除。"
        confirmText="删除"
        variant="danger"
        onConfirm={handleDeleteModel}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 添加/编辑模型弹窗 */}
      {dialogConfig && (
        <ModelDialog
          title={dialogConfig.mode === "edit" ? "编辑模型" : "添加模型"}
          initial={
            dialogConfig.model
              ? {
                  name: dialogConfig.model.name,
                  baseUrl: dialogConfig.model.baseUrl,
                  modelName: dialogConfig.model.modelName
                }
              : undefined
          }
          category={dialogConfig.category}
          saving={saving}
          onClose={() => setDialogConfig(null)}
          onSave={handleSaveModel}
          onTest={handleTestInDialog}
        />
      )}

      {/* 侧边栏 */}
      <aside className="sticky top-0 h-screen border-r border-border/60 bg-surface">
        <div className="px-3 pb-3 pt-6">
          <div className="mb-3 px-2.5 text-[15px] font-semibold text-foreground">设置</div>
          <nav className="space-y-0.5">
            {primaryNav.map(({ key, label, icon: Icon }) => {
              const active = activeSection === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] transition-all",
                    active
                      ? "bg-primary/10 font-medium text-foreground"
                      : "text-secondary hover:bg-overlay hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted")} />
                  <span>{label}</span>
                </button>
              )
            })}
            <div className="my-2 border-t border-border/40" />
            {secondaryNav.map(({ key, label, icon: Icon }) => {
              const active = activeSection === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] transition-all",
                    active
                      ? "bg-primary/10 font-medium text-foreground"
                      : "text-secondary hover:bg-overlay hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted")} />
                  <span>{label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* 内容区 */}
      <div className="overflow-y-auto px-10 py-10">

        {/* ——— 模型配置 ——— */}
        {activeSection === "model" && (
          <div className="max-w-5xl space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold">模型配置</h1>
                <p className="mt-1 text-sm text-muted">管理和配置 AI 模型的接入信息</p>
              </div>
              <Button onClick={() => setDialogConfig({ mode: "add", category: "language" })}>
                <Plus className="mr-1.5 h-4 w-4" />
                添加模型
              </Button>
            </div>

            <Card>
              {/* 表头 */}
              <div className="grid items-center gap-4 border-b border-border/60 bg-[#F9F9F9] px-5 text-xs font-medium text-muted [grid-template-columns:220px_120px_1fr_80px_80px_140px] dark:bg-elevated/50" style={{ height: 44 }}>
                <span>模型名称</span>
                <span>提供商</span>
                <span>接入地址</span>
                <span>类型</span>
                <span>状态</span>
                <span>操作</span>
              </div>

              {langModels.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted">
                  暂无模型，点击「添加模型」开始配置
                </div>
              ) : (
                langModels.map((model) => {
                  const result = testResults[model.id]
                  return (
                    <div
                      key={model.id}
                      className="grid h-16 items-center gap-4 border-b border-border/40 px-5 last:border-0 [grid-template-columns:220px_120px_1fr_80px_80px_140px]"
                    >
                      {/* 名称 */}
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Cpu className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="truncate text-[14px] font-medium">{model.name}</span>
                      </div>
                      {/* 提供商 */}
                      <span className="text-[13px] text-secondary">{inferProvider(model.baseUrl)}</span>
                      {/* 接入地址 */}
                      <span className="truncate text-xs text-muted">{model.baseUrl || "—"}</span>
                      {/* 类型 */}
                      <span className="inline-flex items-center rounded-[5px] bg-[#F3F4F6] px-2 py-0.5 text-xs text-secondary dark:bg-elevated">
                        {inferModelType(model)}
                      </span>
                      {/* 状态 */}
                      <div>
                        {result === "ok" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-[5px] bg-[#F0FDF4] px-2 py-0.5 text-xs font-medium text-green-600 dark:bg-green-500/10 dark:text-green-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-500" />
                            已连接
                          </span>
                        ) : result === "error" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-[5px] bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            离线
                          </span>
                        ) : result === "testing" ? (
                          <span className="text-xs text-muted">测试中...</span>
                        ) : (
                          <span className="inline-flex items-center rounded-[5px] bg-elevated px-2 py-0.5 text-xs text-muted">
                            已配置
                          </span>
                        )}
                      </div>
                      {/* 操作 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestByID(model.id)}
                          disabled={result === "testing"}
                          className="flex h-[30px] items-center rounded-md border border-border/60 bg-elevated px-2.5 text-xs text-secondary hover:text-foreground disabled:opacity-40"
                        >
                          测试
                        </button>
                        <button
                          onClick={() =>
                            setDialogConfig({ mode: "edit", category: model.category, model })
                          }
                          className="flex h-[30px] items-center rounded-md border border-border/60 bg-elevated px-2.5 text-xs text-secondary hover:text-foreground"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => setDeleteTarget(model.id)}
                          className="rounded-md p-1.5 text-muted hover:bg-elevated hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </Card>
          </div>
        )}

        {/* ——— 场景配置 ——— */}
        {activeSection === "scene" && (
          <div className="max-w-4xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">场景配置</h1>
              <p className="mt-1 text-sm text-muted">
                为不同场景指定使用的 AI 模型，优化各功能的响应质量
              </p>
            </div>

            <Card>
              <div className="grid items-center gap-4 border-b border-border/60 bg-elevated/50 px-5 py-3 text-xs font-medium text-muted [grid-template-columns:1fr_1.5fr_200px]">
                <span>场景</span>
                <span>描述</span>
                <span>指定模型</span>
              </div>
              {sceneFeatures.map((feat) => {
                const options = modelConfigs.filter((m) => m.category === feat.category)
                const bound = modelBindings.find((b) => b.feature === feat.key)
                const Icon = feat.icon
                return (
                  <div
                    key={feat.key}
                    className="grid items-center gap-4 border-b border-border/40 px-5 py-4 last:border-0 [grid-template-columns:1fr_1.5fr_200px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{feat.label}</span>
                    </div>
                    <span className="text-sm text-muted">{feat.desc}</span>
                    <div className="relative">
                      <select
                        className="h-9 w-full appearance-none rounded-lg border border-border bg-surface px-3 pr-8 text-sm outline-none transition-colors hover:border-primary/40 focus:border-primary/60"
                        value={bound?.modelId ?? ""}
                        onChange={(e) => saveBinding(feat.key, e.target.value)}
                      >
                        <option value="">未分配</option>
                        {options.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                    </div>
                  </div>
                )
              })}
            </Card>
          </div>
        )}

        {/* ——— Embedding 配置 ——— */}
        {activeSection === "embedding" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">Embedding 配置</h1>
              <p className="mt-1 text-sm text-muted">配置用于语义检索和知识提炼的向量模型</p>
            </div>

            <EmbeddingForm
              initial={embeddingModel}
              onSave={async (form) => {
                setSaving(true)
                const url = embeddingModel
                  ? `/api/settings/models/${embeddingModel.id}`
                  : "/api/settings/models"
                const resp = await fetch(url, {
                  method: embeddingModel ? "PUT" : "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ ...form, category: "embedding" })
                })
                setSaving(false)
                await refreshAndShow("Embedding 配置已保存", resp)
              }}
              onTest={async (form) => {
                setTesting(true)
                const resp = await fetch("/api/settings/models/test", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ ...form, category: "embedding" })
                })
                setTesting(false)
                const data = await resp.json().catch(() => ({}))
                showToast(resp.ok ? "连通性测试成功 ✓" : data.error ?? "测试失败")
              }}
              saving={saving}
              testing={testing}
            />
          </div>
        )}

        {/* ——— 同步与存储 ——— */}
        {activeSection === "sync" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">同步与存储</h1>
              <p className="mt-1 text-sm text-muted">管理书库同步频率和本地存储策略</p>
            </div>

            {/* 同步设置卡片 */}
            <Card>
              <div className="border-b border-border/60 px-5 py-3.5">
                <span className="text-sm font-medium">同步设置</span>
              </div>
              <div className="divide-y divide-border/40">
                {/* 自动同步 toggle */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="text-sm font-medium">自动同步</div>
                    <div className="mt-0.5 text-xs text-muted">新书添加后自动开始同步处理</div>
                  </div>
                  <Toggle value={isAutoSync} onChange={handleAutoSyncToggle} />
                </div>
                {/* 同步频率 */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className={cn("text-sm font-medium", !isAutoSync && "text-muted")}>
                      同步频率
                    </div>
                    <div className="mt-0.5 text-xs text-muted">定期重新扫描书库变更</div>
                  </div>
                  <div className="relative">
                    <select
                      disabled={!isAutoSync}
                      className="h-9 w-36 appearance-none rounded-lg border border-border bg-surface px-3 pr-8 text-sm outline-none transition-colors hover:border-primary/40 focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
                      value={syncFreq}
                      onChange={(e) => handleFreqChange(e.target.value as "daily" | "weekly")}
                    >
                      <option value="daily">每天</option>
                      <option value="weekly">每周</option>
                    </select>
                    <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  </div>
                </div>
              </div>
            </Card>

            {/* 存储空间卡片 */}
            <Card>
              <div className="border-b border-border/60 px-5 py-3.5">
                <span className="text-sm font-medium">存储空间</span>
              </div>
              <div className="px-5 py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary">存储模式</span>
                  <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">
                    平台默认
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary">MinIO 服务</span>
                  <span className="font-mono text-xs text-muted">
                    {process.env.NEXT_PUBLIC_MINIO_ENDPOINT ?? "localhost:29000"}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-elevated/30 px-4 py-3">
                  <HardDrive className="h-4 w-4 shrink-0 text-muted" />
                  <span className="text-sm text-secondary">存储容量由平台统一管理，无需手动配置</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ——— 账户 ——— */}
        {activeSection === "account" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">账户</h1>
              <p className="mt-1 text-sm text-muted">管理账户信息和安全设置</p>
            </div>

            {/* 用户信息卡片 */}
            <Card className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                {profileName?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{profileName}</div>
                <div className="mt-0.5 text-xs text-muted">本地账户</div>
              </div>
            </Card>

            {/* 基本信息 */}
            <Card className="p-5">
              <div className="mb-4 text-sm font-medium">基本信息</div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">显示名称</label>
                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveProfile}>保存</Button>
                </div>
              </div>
            </Card>

            {/* 修改密码 */}
            <Card className="p-5">
              <div className="mb-4 text-sm font-medium">修改密码</div>
              <div className="space-y-3">
                <Input
                  placeholder="当前密码"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <Input
                  placeholder="新密码"
                  type="password"
                  value={nextPassword}
                  onChange={(e) => setNextPassword(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button onClick={changePassword}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    修改密码
                  </Button>
                </div>
              </div>
            </Card>

            {/* 账户操作 */}
            <Card className="p-5">
              <div className="mb-4 text-sm font-medium">账户操作</div>
              <div className="flex flex-wrap gap-2">
                <a href="/api/account/export">
                  <Button variant="secondary">
                    <Download className="mr-2 h-4 w-4" />
                    导出数据
                  </Button>
                </a>
                <Button variant="ghost" onClick={logout}>
                  退出登录
                </Button>
                <Button variant="destructive" onClick={deleteAccount}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  注销账户
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ——— 阅读设置 ——— */}
        {activeSection === "reader" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">阅读设置</h1>
              <p className="mt-1 text-sm text-muted">自定义阅读器的外观和行为</p>
            </div>

            <Card className="p-6">
              <div className="mb-4 text-sm font-medium">翻页模式</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "horizontal", label: "左右翻页", desc: "横向滑动切换页面" },
                  { key: "vertical", label: "上下滚动", desc: "纵向滚动浏览内容" }
                ].map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() =>
                      setReaderForm((c) => ({
                        ...c,
                        navigationMode: key as "horizontal" | "vertical"
                      }))
                    }
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      readerForm.navigationMode === key
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface hover:border-primary/30"
                    )}
                  >
                    <div className="text-sm font-medium">{label}</div>
                    <div className="mt-0.5 text-xs text-muted">{desc}</div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4 text-sm font-medium">字体大小</div>
              <div className="flex gap-2">
                {fontSizeOptions.map((size) => (
                  <button
                    key={size}
                    onClick={() => setReaderForm((c) => ({ ...c, fontSize: size }))}
                    className={cn(
                      "flex-1 rounded-lg py-2.5 text-sm transition-all",
                      readerForm.fontSize === size
                        ? "bg-primary text-white"
                        : "bg-elevated text-secondary hover:text-foreground"
                    )}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4 text-sm font-medium">行高</div>
              <div className="flex gap-2">
                {lineHeightOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setReaderForm((c) => ({ ...c, lineHeight: opt.value }))}
                    className={cn(
                      "flex-1 rounded-lg py-2.5 text-sm transition-all",
                      readerForm.lineHeight === opt.value
                        ? "bg-primary text-white"
                        : "bg-elevated text-secondary hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4 text-sm font-medium">字体</div>
              <div className="flex gap-2">
                {fontFamilyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setReaderForm((c) => ({
                        ...c,
                        fontFamily: opt.value as "system" | "serif" | "sans"
                      }))
                    }
                    className={cn(
                      "flex-1 rounded-lg py-2.5 text-sm transition-all",
                      readerForm.fontFamily === opt.value
                        ? "bg-primary text-white"
                        : "bg-elevated text-secondary hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4 text-sm font-medium">默认阅读主题</div>
              <div className="grid grid-cols-3 gap-3">
                {readerThemeOptions.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() =>
                      setReaderForm((c) => ({
                        ...c,
                        theme: value as "day" | "sepia" | "night"
                      }))
                    }
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all",
                      readerForm.theme === value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface text-secondary hover:border-primary/30"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-2 text-sm font-medium">翻译偏好</div>
              <p className="mb-4 text-xs text-muted">
                进入译文模式后，会按当前页和后 3 页做滚动预翻译，并优先复用已缓存结果。
              </p>
              <div className="grid grid-cols-2 gap-3">
                {translationViewOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setReaderForm((c) => ({ ...c, translationView: option.value }))
                    }
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      readerForm.translationView === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface hover:border-primary/30"
                    )}
                  >
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="mt-0.5 text-xs text-muted">{option.desc}</div>
                  </button>
                ))}
              </div>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveReaderSettings} disabled={savingReader}>
                {savingReader ? "保存中..." : "保存设置"}
              </Button>
            </div>
          </div>
        )}

        {/* ——— 外观设置 ——— */}
        {activeSection === "appearance" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">外观设置</h1>
              <p className="mt-1 text-sm text-muted">自定义界面主题和显示效果</p>
            </div>
            <Card className="p-6">
              <div className="mb-4 text-sm font-medium">主题模式</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "light", label: "明亮", icon: Sun },
                  { key: "dark", label: "夜间", icon: Moon },
                  { key: "system", label: "跟随系统", icon: Monitor }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setAppTheme(key as AppTheme)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all",
                      appTheme === key
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface text-secondary hover:border-primary/50"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// ————— Embedding 子表单（独立组件避免主组件过长） —————

interface EmbeddingFormProps {
  initial?: ModelConfig
  saving: boolean
  testing: boolean
  onSave: (form: { name: string; baseUrl: string; apiKey: string; modelName: string }) => void
  onTest: (form: { name: string; baseUrl: string; apiKey: string; modelName: string }) => void
}

function EmbeddingForm({ initial, saving, testing, onSave, onTest }: EmbeddingFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? "Embedding 模型",
    baseUrl: initial?.baseUrl ?? "",
    apiKey: "",
    modelName: initial?.modelName ?? ""
  })

  return (
    <Card className="p-6 space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted">向量模型</label>
        <Input
          placeholder="text-embedding-3-small"
          value={form.modelName}
          onChange={(e) => setForm((c) => ({ ...c, modelName: e.target.value }))}
        />
      </div>
      <div className="border-t border-border/40" />
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted">接入地址（Base URL）</label>
        <Input
          placeholder="https://api.openai.com/v1"
          value={form.baseUrl}
          onChange={(e) => setForm((c) => ({ ...c, baseUrl: e.target.value }))}
        />
      </div>
      <div className="border-t border-border/40" />
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          API Key
          {initial && (
            <span className="ml-2 font-normal text-muted/60">（留空保留现有密钥）</span>
          )}
        </label>
        <Input
          placeholder={initial ? "••••••••••••••••" : "请输入 API Key"}
          value={form.apiKey}
          onChange={(e) => setForm((c) => ({ ...c, apiKey: e.target.value }))}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="border-t border-border/40" />
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => onTest(form)}
          disabled={testing || !form.baseUrl || !form.modelName}
        >
          {testing ? "测试中..." : "测试连接"}
        </Button>
        <Button
          onClick={() => onSave(form)}
          disabled={saving || !form.modelName}
        >
          {saving ? "保存中..." : "保存配置"}
        </Button>
      </div>
    </Card>
  )
}
