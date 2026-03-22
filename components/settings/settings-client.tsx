"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Cloud,
  Cpu,
  Download,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  User2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import type {
  ModelConfig,
  ReaderSettings,
  StorageConfig,
  User
} from "@/src/server/store/types"

type SectionKey = "model" | "storage" | "sync" | "reader" | "account"
type ModelType = "aggregation" | "synthesis" | "explain" | "embedding"

const sections: {
  key: SectionKey
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: "model", label: "模型配置", icon: Cpu },
  { key: "storage", label: "存储配置", icon: Cloud },
  { key: "sync", label: "同步配置", icon: RefreshCcw },
  { key: "reader", label: "阅读设置", icon: ShieldCheck },
  { key: "account", label: "账户配置", icon: User2 }
]

const modelTabs: { key: ModelType; label: string }[] = [
  { key: "explain", label: "即时解释" },
  { key: "synthesis", label: "文章生成" },
  { key: "aggregation", label: "聚合分析" },
  { key: "embedding", label: "Embedding" }
]

export function SettingsClient({
  user,
  modelConfigs,
  storageConfig,
  readerSettings
}: {
  user: User
  modelConfigs: ModelConfig[]
  storageConfig?: StorageConfig
  readerSettings?: ReaderSettings
}) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SectionKey>("model")
  const [activeModelType, setActiveModelType] = useState<ModelType>("explain")
  const [toast, setToast] = useState("")

  const currentModel = useMemo(
    () => modelConfigs.find((item) => item.usage === activeModelType),
    [activeModelType, modelConfigs]
  )

  const [modelForm, setModelForm] = useState({
    baseUrl: "",
    apiKey: "",
    modelName: ""
  })
  const [storageForm, setStorageForm] = useState({
    useCustom: storageConfig?.useCustom ?? false,
    endpoint: storageConfig?.endpoint ?? "",
    accessKey: storageConfig?.accessKey ?? "",
    secretKey: "",
    bucket: storageConfig?.bucket ?? "",
    region: storageConfig?.region ?? "us-east-1"
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

  useEffect(() => {
    setModelForm({
      baseUrl: currentModel?.baseUrl ?? "",
      apiKey: "",
      modelName: currentModel?.modelName === "未配置" ? "" : currentModel?.modelName ?? ""
    })
  }, [currentModel])

  async function saveModel() {
    const response = await fetch(`/api/settings/models/${activeModelType}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usage: activeModelType, ...modelForm })
    })
    setToast(response.ok ? "模型配置已保存" : "模型配置保存失败")
    router.refresh()
  }

  async function testModel() {
    const response = await fetch("/api/settings/models/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usage: activeModelType, ...modelForm })
    })
    setToast(response.ok ? "连通性测试成功" : "连通性测试失败")
  }

  async function saveStorage() {
    const response = await fetch("/api/settings/storage", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(storageForm)
    })
    setToast(response.ok ? "存储配置已保存" : "存储配置保存失败")
    router.refresh()
  }

  async function saveSchedule() {
    const response = await fetch("/api/settings/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aggregateSchedule: schedule })
    })
    setToast(response.ok ? "同步配置已保存" : "同步配置保存失败")
    router.refresh()
  }

  async function runAggregate() {
    const response = await fetch("/api/aggregate", { method: "POST" })
    setToast(response.ok ? "已触发一次聚合" : "聚合触发失败")
  }

  async function saveReaderSettings() {
    const response = await fetch("/api/settings/reader", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(readerForm)
    })
    setToast(response.ok ? "阅读设置已保存" : "阅读设置保存失败")
    router.refresh()
  }

  async function saveProfile() {
    const response = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    })
    setToast(response.ok ? "账户信息已保存" : "账户信息保存失败")
    router.refresh()
  }

  async function changePassword() {
    const response = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, nextPassword })
    })
    setToast(response.ok ? "密码修改成功" : "密码修改失败")
    if (response.ok) {
      setCurrentPassword("")
      setNextPassword("")
    }
  }

  async function deleteAccount() {
    const response = await fetch("/api/account", { method: "DELETE" })
    if (response.ok) {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/login")
      router.refresh()
      return
    }
    setToast("账户注销失败")
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)] bg-base">
      {toast ? (
        <Toast title={toast} tone="success" onClose={() => setToast("")} />
      ) : null}
      <aside className="border-r border-border bg-[#0D0D0F] p-4">
        <div className="mb-6 text-lg font-semibold">设置</div>
        <div className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.key}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  activeSection === section.key
                    ? "bg-elevated text-foreground"
                    : "text-secondary hover:bg-overlay hover:text-foreground"
                }`}
                onClick={() => setActiveSection(section.key)}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            )
          })}
        </div>
      </aside>

      <div className="px-12 py-10">
        {activeSection === "model" ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">模型配置</h1>
              <p className="mt-2 text-sm text-secondary">
                右侧一次只显示当前 Type 的配置内容，不再把所有模型表单堆叠在一起。
              </p>
            </div>
            <div className="flex gap-2">
              {modelTabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeModelType === tab.key ? "primary" : "secondary"}
                  onClick={() => setActiveModelType(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <Card className="max-w-4xl space-y-5 p-6">
              <div className="text-sm text-secondary">
                当前配置：{currentModel?.modelName || "未配置"} / Key：
                {currentModel?.apiKey || "未保存"}
              </div>
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
                placeholder="API Key（留空则保持现有值）"
                value={modelForm.apiKey}
                onChange={(event) =>
                  setModelForm((current) => ({ ...current, apiKey: event.target.value }))
                }
              />
              <div className="flex gap-2">
                <Button onClick={saveModel}>保存配置</Button>
                <Button variant="secondary" onClick={testModel}>
                  测试连通
                </Button>
              </div>
            </Card>
          </div>
        ) : null}

        {activeSection === "storage" ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">存储配置</h1>
              <p className="mt-2 text-sm text-secondary">
                这里的配置会真实写入后端，并直接影响书籍上传时使用的平台默认存储或自定义对象存储。
              </p>
            </div>
            <Card className="max-w-4xl space-y-5 p-6">
              <div className="flex gap-2">
                <Button
                  variant={storageForm.useCustom ? "secondary" : "primary"}
                  onClick={() =>
                    setStorageForm((current) => ({ ...current, useCustom: false }))
                  }
                >
                  平台默认
                </Button>
                <Button
                  variant={storageForm.useCustom ? "primary" : "secondary"}
                  onClick={() =>
                    setStorageForm((current) => ({ ...current, useCustom: true }))
                  }
                >
                  自定义 MinIO
                </Button>
              </div>
              <Input
                placeholder="Endpoint"
                value={storageForm.endpoint}
                onChange={(event) =>
                  setStorageForm((current) => ({ ...current, endpoint: event.target.value }))
                }
              />
              <Input
                placeholder="Access Key"
                value={storageForm.accessKey}
                onChange={(event) =>
                  setStorageForm((current) => ({ ...current, accessKey: event.target.value }))
                }
              />
              <Input
                placeholder="Secret Key（留空则保持现有值）"
                value={storageForm.secretKey}
                onChange={(event) =>
                  setStorageForm((current) => ({ ...current, secretKey: event.target.value }))
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Bucket"
                  value={storageForm.bucket}
                  onChange={(event) =>
                    setStorageForm((current) => ({ ...current, bucket: event.target.value }))
                  }
                />
                <Input
                  placeholder="Region"
                  value={storageForm.region}
                  onChange={(event) =>
                    setStorageForm((current) => ({ ...current, region: event.target.value }))
                  }
                />
              </div>
              <Button onClick={saveStorage}>保存存储配置</Button>
            </Card>
          </div>
        ) : null}

        {activeSection === "sync" ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">同步配置</h1>
              <p className="mt-2 text-sm text-secondary">
                配置自动聚合频率，并可手动触发一次全量聚合。
              </p>
            </div>
            <Card className="max-w-4xl space-y-5 p-6">
              <div className="flex gap-2">
                {(["manual", "daily", "weekly"] as const).map((item) => (
                  <Button
                    key={item}
                    variant={schedule === item ? "primary" : "secondary"}
                    onClick={() => setSchedule(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={saveSchedule}>保存同步配置</Button>
                <Button variant="secondary" onClick={runAggregate}>
                  立即聚合一次
                </Button>
              </div>
            </Card>
          </div>
        ) : null}

        {activeSection === "reader" ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">阅读设置</h1>
              <p className="mt-2 text-sm text-secondary">
                这里负责存储阅读偏好，当前已支持分页切换方向，后续可以继续扩展更多阅读行为设置。
              </p>
            </div>
            <Card className="max-w-4xl space-y-5 p-6">
              <div className="text-sm font-medium">切换方向</div>
              <div className="flex gap-2">
                <Button
                  variant={readerForm.navigationMode === "horizontal" ? "primary" : "secondary"}
                  onClick={() =>
                    setReaderForm((current) => ({ ...current, navigationMode: "horizontal" }))
                  }
                >
                  左右翻页
                </Button>
                <Button
                  variant={readerForm.navigationMode === "vertical" ? "primary" : "secondary"}
                  onClick={() =>
                    setReaderForm((current) => ({ ...current, navigationMode: "vertical" }))
                  }
                >
                  上下翻页
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  placeholder="字体大小"
                  value={String(readerForm.fontSize)}
                  onChange={(event) =>
                    setReaderForm((current) => ({
                      ...current,
                      fontSize: Number(event.target.value) as 14 | 16 | 18 | 20 | 22
                    }))
                  }
                />
                <Input
                  placeholder="行高"
                  value={String(readerForm.lineHeight)}
                  onChange={(event) =>
                    setReaderForm((current) => ({
                      ...current,
                      lineHeight: Number(event.target.value) as 1.5 | 1.6 | 1.75 | 2
                    }))
                  }
                />
                <Input
                  placeholder="字体 family"
                  value={readerForm.fontFamily}
                  onChange={(event) =>
                    setReaderForm((current) => ({
                      ...current,
                      fontFamily: event.target.value as "system" | "serif" | "sans"
                    }))
                  }
                />
              </div>
              <Button onClick={saveReaderSettings}>保存阅读设置</Button>
            </Card>
          </div>
        ) : null}

        {activeSection === "account" ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">账户配置</h1>
              <p className="mt-2 text-sm text-secondary">
                账户名称、密码、数据导出、退出登录和账户注销均已接入真实后端接口。
              </p>
            </div>
            <Card className="max-w-4xl space-y-5 p-6">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
              <Button onClick={saveProfile}>保存账户信息</Button>
              <div className="border-t border-border pt-5" />
              <div className="grid gap-4 md:grid-cols-2">
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
              <div className="flex flex-wrap gap-2">
                <Button onClick={changePassword}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  修改密码
                </Button>
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
