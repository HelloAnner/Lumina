"use client"

import React, { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Cloud,
  Cpu,
  Download,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  RefreshCcw,
  ShieldCheck,
  Sun,
  Trash2,
  User2,
  ChevronRight,
  Check,
  Settings2,
  BookOpen,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { useTheme, type AppTheme } from "@/components/theme-provider"
import { cn } from "@/src/lib/utils"
import type {
  ModelBinding,
  ModelCategory,
  ModelConfig,
  ReaderSettings,
  User
} from "@/src/server/store/types"

type SectionKey = "appearance" | "model" | "sync" | "reader" | "account"

const sections = [
  { key: "appearance", label: "外观", icon: Palette },
  { key: "model", label: "模型", icon: Cpu },
  { key: "sync", label: "同步", icon: RefreshCcw },
  { key: "reader", label: "阅读", icon: BookOpen },
  { key: "account", label: "账户", icon: User2 }
] as const

const categoryTabs: { key: ModelCategory; label: string }[] = [
  { key: "language", label: "语言模型" },
  { key: "speech", label: "语音模型" },
  { key: "embedding", label: "Embedding" }
]

const features: { key: ModelBinding["feature"]; label: string; category: ModelCategory }[] = [
  { key: "instant_explain", label: "即时解释", category: "language" },
  { key: "article_generate", label: "文章生成", category: "language" },
  { key: "aggregation_analyze", label: "聚合分析", category: "language" },
  { key: "voice_read", label: "语音朗读", category: "speech" },
  { key: "embedding_index", label: "索引构建", category: "embedding" }
]

const scheduleOptions = [
  { value: "manual", label: "手动同步", desc: "仅在需要时手动触发" },
  { value: "daily", label: "每日同步", desc: "每天自动同步一次" },
  { value: "weekly", label: "每周同步", desc: "每周自动同步一次" }
] as const

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
  const [activeSection, setActiveSection] = useState<SectionKey>("appearance")
  const [activeCategory, setActiveCategory] = useState<ModelCategory>("language")
  const [toast, setToast] = useState("")

  // 模型表单
  const [modelForm, setModelForm] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
    modelName: ""
  })
  const [testingModel, setTestingModel] = useState(false)

  // 同步设置
  const [schedule, setSchedule] = useState(user.aggregateSchedule)
  const [savingSchedule, setSavingSchedule] = useState(false)

  // 阅读设置
  const [readerForm, setReaderForm] = useState({
    fontSize: readerSettings?.fontSize ?? 16,
    lineHeight: readerSettings?.lineHeight ?? 1.75,
    fontFamily: readerSettings?.fontFamily ?? "serif",
    theme: readerSettings?.theme ?? "night",
    navigationMode: readerSettings?.navigationMode ?? "horizontal"
  })
  const [savingReader, setSavingReader] = useState(false)

  // 账户设置
  const [name, setName] = useState(user.name)
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")

  const showToast = useCallback((message: string) => {
    setToast(message)
  }, [])

  const refreshAndShow = useCallback(async (message: string, response: Response) => {
    if (response.ok) {
      showToast(message)
      router.refresh()
    } else {
      const data = await response.json()
      showToast(data.error || `${message}失败`)
    }
  }, [router, showToast])

  const filteredModels = useMemo(
    () => modelConfigs.filter((item) => item.category === activeCategory),
    [activeCategory, modelConfigs]
  )

  async function addModel() {
    if (!modelForm.name || !modelForm.modelName) {
      showToast("请填写完整信息")
      return
    }
    const response = await fetch("/api/settings/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...modelForm,
        category: activeCategory
      })
    })
    if (response.ok) {
      setModelForm({ name: "", baseUrl: "", apiKey: "", modelName: "" })
    }
    await refreshAndShow("模型已添加", response)
  }

  async function testModel() {
    if (!modelForm.baseUrl || !modelForm.modelName) {
      showToast("请填写 Base URL 和 Model Name")
      return
    }
    setTestingModel(true)
    const response = await fetch("/api/settings/models/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...modelForm,
        category: activeCategory
      })
    })
    const data = await response.json()
    setTestingModel(false)
    showToast(response.ok ? "连通性测试成功" : data.error || "测试失败")
  }

  async function deleteModel(modelId: string) {
    const response = await fetch(`/api/settings/models/${modelId}`, { method: "DELETE" })
    await refreshAndShow("模型已删除", response)
  }

  async function saveBinding(feature: ModelBinding["feature"], modelId: string) {
    const response = await fetch("/api/settings/model-bindings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feature, modelId })
    })
    await refreshAndShow("功能配置已保存", response)
  }

  async function saveSchedule() {
    setSavingSchedule(true)
    const response = await fetch("/api/settings/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aggregateSchedule: schedule })
    })
    setSavingSchedule(false)
    await refreshAndShow("同步配置已保存", response)
  }

  async function saveReaderSettings() {
    setSavingReader(true)
    const response = await fetch("/api/settings/reader", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(readerForm)
    })
    setSavingReader(false)
    await refreshAndShow("阅读设置已保存", response)
  }

  async function saveProfile() {
    const response = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    })
    await refreshAndShow("账户信息已保存", response)
  }

  async function changePassword() {
    if (!currentPassword || !nextPassword) {
      showToast("请填写完整密码信息")
      return
    }
    const response = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, nextPassword })
    })
    if (response.ok) {
      setCurrentPassword("")
      setNextPassword("")
    }
    showToast(response.ok ? "密码修改成功" : "密码修改失败")
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  async function deleteAccount() {
    const response = await fetch("/api/account", { method: "DELETE" })
    if (response.ok) {
      await logout()
      return
    }
    setToast("账户注销失败")
  }

  return (
    <div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)] bg-base">
      {toast ? <Toast title={toast} onClose={() => setToast("")} /> : null}

      {/* Sidebar */}
      <aside className="sticky top-0 h-screen border-r border-border/60 bg-surface">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Settings2 className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight">设置</span>
        </div>
        <nav className="space-y-0.5 px-3 py-2">
          {sections.map((section) => {
            const Icon = section.icon
            const active = activeSection === section.key
            return (
              <button
                key={section.key}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-elevated text-foreground"
                    : "text-secondary hover:bg-overlay/70 hover:text-foreground"
                )}
                onClick={() => setActiveSection(section.key)}
              >
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted")} />
                <span>{section.label}</span>
                {active && <ChevronRight className="ml-auto h-4 w-4 text-muted" />}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="px-8 py-8">
        {/* 外观设置 */}
        {activeSection === "appearance" && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">外观设置</h1>
              <p className="mt-1 text-sm text-muted">自定义界面主题和显示效果</p>
            </div>

            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">主题模式</div>
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

        {/* 模型设置 */}
        {activeSection === "model" && (
          <div className="mx-auto max-w-3xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">模型配置</h1>
              <p className="mt-1 text-sm text-muted">配置 AI 模型连接信息并分配给不同功能</p>
            </div>

            {/* 模型类型选择 */}
            <div className="flex gap-1 rounded-lg bg-elevated p-1">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveCategory(tab.key)}
                  className={cn(
                    "flex-1 rounded-md px-4 py-2 text-sm transition-all",
                    activeCategory === tab.key
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 添加模型 */}
            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">添加模型</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  placeholder="显示名称"
                  value={modelForm.name}
                  onChange={(e) => setModelForm((c) => ({ ...c, name: e.target.value }))}
                />
                <Input
                  placeholder="Base URL"
                  value={modelForm.baseUrl}
                  onChange={(e) => setModelForm((c) => ({ ...c, baseUrl: e.target.value }))}
                />
                <Input
                  placeholder="Model Name"
                  value={modelForm.modelName}
                  onChange={(e) => setModelForm((c) => ({ ...c, modelName: e.target.value }))}
                />
                <Input
                  placeholder="API Key"
                  type="password"
                  value={modelForm.apiKey}
                  onChange={(e) => setModelForm((c) => ({ ...c, apiKey: e.target.value }))}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={addModel}>添加模型</Button>
                <Button variant="secondary" onClick={testModel} disabled={testingModel}>
                  {testingModel ? "测试中..." : "测试连通"}
                </Button>
              </div>
            </Card>

            {/* 模型列表 */}
            <Card className="p-6">
              <div className="mb-4 text-sm font-medium">已配置模型</div>
              {filteredModels.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
                  暂无 {categoryTabs.find((t) => t.key === activeCategory)?.label} 配置
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredModels.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-surface/50 px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium">{model.name}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {model.modelName}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteModel(model.id)}
                        className="h-8 w-8 p-0 text-muted hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 功能绑定 */}
            <Card className="p-6">
              <div className="mb-4 text-sm font-medium">功能分配</div>
              <div className="space-y-3">
                {features
                  .filter((f) => f.category === activeCategory)
                  .map((feature) => {
                    const options = modelConfigs.filter(
                      (item) => item.category === feature.category
                    )
                    const current = modelBindings.find((item) => item.feature === feature.key)
                    return (
                      <div
                        key={feature.key}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-surface/50 px-4 py-3"
                      >
                        <span className="text-sm">{feature.label}</span>
                        <select
                          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary/50"
                          value={current?.modelId ?? ""}
                          onChange={(e) => saveBinding(feature.key, e.target.value)}
                        >
                          <option value="">未分配</option>
                          {options.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
              </div>
            </Card>
          </div>
        )}

        {/* 同步设置 */}
        {activeSection === "sync" && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">同步配置</h1>
              <p className="mt-1 text-sm text-muted">设置数据聚合和同步的频率</p>
            </div>

            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">同步频率</div>
              <div className="space-y-2">
                {scheduleOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSchedule(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all",
                      schedule === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface hover:border-primary/30"
                    )}
                  >
                    <div>
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="mt-0.5 text-xs text-muted">{option.desc}</div>
                    </div>
                    {schedule === option.value && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={saveSchedule} disabled={savingSchedule}>
                  {savingSchedule ? "保存中..." : "保存配置"}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* 阅读设置 */}
        {activeSection === "reader" && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">阅读设置</h1>
              <p className="mt-1 text-sm text-muted">自定义阅读器的外观和行为</p>
            </div>

            {/* 翻页模式 */}
            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">翻页模式</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "horizontal", label: "左右翻页", desc: "横向滑动切换页面" },
                  { key: "vertical", label: "上下滚动", desc: "纵向滚动浏览内容" }
                ].map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() =>
                      setReaderForm((c) => ({ ...c, navigationMode: key as "horizontal" | "vertical" }))
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

            {/* 字体大小 */}
            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">字体大小</div>
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

            {/* 行高 */}
            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">行高</div>
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

            {/* 字体 */}
            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">字体</div>
              <div className="flex gap-2">
                {fontFamilyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setReaderForm((c) => ({ ...c, fontFamily: opt.value as "system" | "serif" | "sans" }))
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

            {/* 阅读主题 */}
            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">默认阅读主题</div>
              <div className="grid grid-cols-3 gap-3">
                {readerThemeOptions.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() =>
                      setReaderForm((c) => ({ ...c, theme: value as "day" | "sepia" | "night" }))
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

            <div className="flex justify-end">
              <Button onClick={saveReaderSettings} disabled={savingReader}>
                {savingReader ? "保存中..." : "保存设置"}
              </Button>
            </div>
          </div>
        )}

        {/* 账户设置 */}
        {activeSection === "account" && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-semibold">账户配置</h1>
              <p className="mt-1 text-sm text-muted">管理账户信息和安全设置</p>
            </div>

            {/* 存储设置 - 放在更深的位置 */}
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-elevated">
                  <Cloud className="h-5 w-5 text-muted" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">存储配置</div>
                  <div className="text-xs text-muted">当前使用平台默认存储服务</div>
                </div>
                <span className="rounded-full bg-elevated px-2.5 py-1 text-xs text-muted">只读</span>
              </div>
            </Card>

            {/* 基本信息 */}
            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">基本信息</div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs text-muted">显示名称</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveProfile}>保存</Button>
                </div>
              </div>
            </Card>

            {/* 修改密码 */}
            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">修改密码</div>
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
            <Card className="p-6">
              <div className="mb-5 text-sm font-medium">账户操作</div>
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
      </div>
    </div>
  )
}
