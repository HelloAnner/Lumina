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
  User2
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

type SectionKey = "appearance" | "model" | "storage" | "sync" | "reader" | "account"

const sections = [
  { key: "appearance", label: "外观设置", icon: Palette },
  { key: "model", label: "模型配置", icon: Cpu },
  { key: "storage", label: "存储配置", icon: Cloud },
  { key: "sync", label: "同步配置", icon: RefreshCcw },
  { key: "reader", label: "阅读设置", icon: ShieldCheck },
  { key: "account", label: "账户配置", icon: User2 }
] as const

const categoryTabs: { key: ModelCategory; label: string }[] = [
  { key: "language", label: "语言模型" },
  { key: "speech", label: "语音模型" },
  { key: "embedding", label: "Embedding 模型" }
]

const features: { key: ModelBinding["feature"]; label: string; category: ModelCategory }[] = [
  { key: "instant_explain", label: "即时解释", category: "language" },
  { key: "article_generate", label: "文章生成", category: "language" },
  { key: "aggregation_analyze", label: "聚合分析", category: "language" },
  { key: "voice_read", label: "语音朗读", category: "speech" },
  { key: "embedding_index", label: "Embedding 索引", category: "embedding" }
]

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
  const [modelForm, setModelForm] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
    modelName: ""
  })
  const [schedule, setSchedule] = useState(user.aggregateSchedule)
  const [readerForm, setReaderForm] = useState({
    fontSize: readerSettings?.fontSize ?? 16,
    lineHeight: readerSettings?.lineHeight ?? 1.75,
    fontFamily: readerSettings?.fontFamily ?? "serif",
    theme: readerSettings?.theme ?? "night",
    navigationMode: readerSettings?.navigationMode ?? "horizontal"
  })
  const [name, setName] = useState(user.name)
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")

  // 抽取通用的 toast 和 refresh 逻辑
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
    const response = await fetch("/api/settings/models/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...modelForm,
        category: activeCategory
      })
    })
    const data = await response.json()
    showToast(response.ok ? "真实连通性测试成功" : data.error || "测试失败")
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
    const response = await fetch("/api/settings/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aggregateSchedule: schedule })
    })
    await refreshAndShow("同步配置已保存", response)
  }

  async function saveReaderSettings() {
    const response = await fetch("/api/settings/reader", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(readerForm)
    })
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
    const response = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, nextPassword })
    })
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
      <aside className="border-r border-border/60 bg-surface p-4">
        <div className="mb-6 text-lg font-semibold tracking-tight">设置</div>
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.key}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  activeSection === section.key
                    ? "bg-elevated text-foreground"
                    : "text-secondary hover:bg-overlay/70 hover:text-foreground"
                )}
                onClick={() => setActiveSection(section.key)}
              >
                <Icon className={cn(
                  "h-4 w-4 transition-colors",
                  activeSection === section.key ? "text-foreground" : "text-muted"
                )} />
                <span className="font-medium">{section.label}</span>
                {activeSection === section.key && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-secondary" />
                )}
              </button>
            )
          })}
        </div>
      </aside>

      <div className="px-12 py-10">
        {activeSection === "appearance" ? (
          <div className="max-w-2xl space-y-6">
            <h1 className="text-2xl font-semibold">外观设置</h1>
            <Card className="space-y-4 p-6">
              <div className="text-sm font-medium">主题模式</div>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { key: "light", label: "明亮", icon: Sun },
                    { key: "dark", label: "黑夜", icon: Moon },
                    { key: "system", label: "跟随系统", icon: Monitor }
                  ] as { key: AppTheme; label: string; icon: React.ComponentType<{ className?: string }> }[]
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setAppTheme(key)}
                    className={`flex flex-col items-center gap-2 rounded-md border px-4 py-5 text-sm transition-all ${
                      appTheme === key
                        ? "border-primary bg-primary-soft text-foreground"
                        : "border-border bg-elevated text-secondary hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {activeSection === "model" ? (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">模型配置</h1>
              <p className="mt-1 text-sm text-muted">配置 AI 模型连接信息</p>
            </div>
            <div className="flex gap-2">
              {categoryTabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeCategory === tab.key ? "secondary" : "ghost"}
                  onClick={() => setActiveCategory(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <Card className="border-border/60 p-6">
              <div className="space-y-4">
                <Input
                  placeholder="显示名称"
                  value={modelForm.name}
                  onChange={(event) =>
                    setModelForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
                <Input
                  placeholder="Base URL"
                  value={modelForm.baseUrl}
                  onChange={(event) =>
                    setModelForm((current) => ({ ...current, baseUrl: event.target.value }))
                  }
                />
                <Input
                  placeholder="Model Name"
                  value={modelForm.modelName}
                  onChange={(event) =>
                    setModelForm((current) => ({ ...current, modelName: event.target.value }))
                  }
                />
                <Input
                  placeholder="API Key"
                  type="password"
                  value={modelForm.apiKey}
                  onChange={(event) =>
                    setModelForm((current) => ({ ...current, apiKey: event.target.value }))
                  }
                />
                <div className="flex gap-2 pt-2">
                  <Button onClick={addModel}>添加模型</Button>
                  <Button variant="secondary" onClick={testModel}>
                    测试联通
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="border-border/60 p-6">
              <div className="mb-4 text-sm font-medium">模型列表</div>
              <div className="space-y-2">
                {filteredModels.length === 0 ? (
                  <div className="rounded-lg border border-border/60 border-dashed p-6 text-center text-sm text-muted">
                    暂无模型配置
                  </div>
                ) : (
                  filteredModels.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-elevated/30 px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium">{model.name}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {model.modelName} · {model.baseUrl}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteModel(model.id)} className="h-8 w-8 p-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="border-border/60 p-6">
              <div className="mb-4 text-sm font-medium">功能配置</div>
              <div className="space-y-4">
                {features.map((feature) => {
                  const options = modelConfigs.filter(
                    (item) => item.category === feature.category
                  )
                  const current = modelBindings.find((item) => item.feature === feature.key)
                  return (
                    <div key={feature.key} className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-4">
                      <div className="text-sm text-muted">{feature.label}</div>
                      <select
                        className="h-10 rounded-lg border border-border/60 bg-elevated px-3 text-sm text-foreground outline-none transition-colors focus:border-secondary/50"
                        value={current?.modelId ?? ""}
                        onChange={(event) => saveBinding(feature.key, event.target.value)}
                      >
                        <option value="">请选择模型</option>
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
        ) : null}

        {activeSection === "storage" ? (
          <div className="max-w-xl space-y-6">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">存储配置</h1>
              <p className="mt-1 text-sm text-muted">管理文件存储设置</p>
            </div>
            <Card className="border-border/60 p-6">
              <div className="flex items-center gap-3 text-sm text-muted">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-elevated">
                  <Cloud className="h-4 w-4" />
                </div>
                <span>当前只允许使用平台默认存储，不再支持自定义配置。</span>
              </div>
            </Card>
          </div>
        ) : null}

        {activeSection === "sync" ? (
          <div className="max-w-xl space-y-6">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">同步配置</h1>
              <p className="mt-1 text-sm text-muted">设置数据同步频率</p>
            </div>
            <Card className="border-border/60 p-6">
              <div className="mb-4 text-sm font-medium">同步频率</div>
              <div className="flex gap-2">
                {(["manual", "daily", "weekly"] as const).map((item) => (
                  <Button
                    key={item}
                    variant={schedule === item ? "secondary" : "ghost"}
                    onClick={() => setSchedule(item)}
                  >
                    {item === "manual" ? "手动" : item === "daily" ? "每日" : "每周"}
                  </Button>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-border/60">
                <Button onClick={saveSchedule}>保存配置</Button>
              </div>
            </Card>
          </div>
        ) : null}

        {activeSection === "reader" ? (
          <div className="max-w-xl space-y-6">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">阅读设置</h1>
              <p className="mt-1 text-sm text-muted">自定义阅读器行为</p>
            </div>
            <Card className="border-border/60 p-6">
              <div className="mb-4 text-sm font-medium">翻页模式</div>
              <div className="flex gap-2">
                <Button
                  variant={readerForm.navigationMode === "horizontal" ? "secondary" : "ghost"}
                  onClick={() =>
                    setReaderForm((current) => ({ ...current, navigationMode: "horizontal" }))
                  }
                >
                  左右翻页
                </Button>
                <Button
                  variant={readerForm.navigationMode === "vertical" ? "secondary" : "ghost"}
                  onClick={() =>
                    setReaderForm((current) => ({ ...current, navigationMode: "vertical" }))
                  }
                >
                  上下滚动
                </Button>
              </div>
              <div className="mt-6 pt-4 border-t border-border/60">
                <Button onClick={saveReaderSettings}>保存设置</Button>
              </div>
            </Card>
          </div>
        ) : null}

        {activeSection === "account" ? (
          <div className="max-w-xl space-y-6">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">账户配置</h1>
              <p className="mt-1 text-sm text-muted">管理账户信息和安全</p>
            </div>
            <Card className="border-border/60 p-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">显示名称</label>
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="pt-2">
                <Button onClick={saveProfile}>保存信息</Button>
              </div>
            </Card>

            <Card className="border-border/60 p-6 space-y-4">
              <div className="mb-2 text-sm font-medium">修改密码</div>
              <div className="grid gap-3">
                <Input
                  placeholder="当前密码"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
                <Input
                  placeholder="新密码"
                  type="password"
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                />
              </div>
              <div className="pt-2">
                <Button onClick={changePassword}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  修改密码
                </Button>
              </div>
            </Card>

            <Card className="border-border/60 p-6">
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
        ) : null}
      </div>
    </div>
  )
}
