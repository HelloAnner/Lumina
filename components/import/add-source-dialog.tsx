/**
 * 添加导入来源对话框
 * 通过浏览器原生目录选择器上传 Vault 文件夹
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
"use client"

import { useRef, useState } from "react"
import { FolderOpen, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const ALLOWED_EXTENSIONS = new Set([
  ".md", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"
])

interface Props {
  onClose: () => void
  onCreated: (jobId?: string) => void
}

export function AddSourceDialog({ onClose, onCreated }: Props) {
  const [name, setName] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [vaultName, setVaultName] = useState("")
  const [excludes, setExcludes] = useState(".obsidian/**\n.trash/**")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  /** 从 FileList 过滤出有效文件 */
  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) {
      return
    }

    const excludePatterns = excludes.split("\n").map((l) => l.trim()).filter(Boolean)
    const files: File[] = []

    for (const file of Array.from(fileList)) {
      const relPath = file.webkitRelativePath
      const parts = relPath.split("/")
      // 第一段是根文件夹名，取后续路径
      const innerPath = parts.slice(1).join("/")

      // 跳过不支持的文件类型
      const ext = innerPath.includes(".") ? `.${innerPath.split(".").pop()?.toLowerCase()}` : ""
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        continue
      }

      // 跳过匹配排除模式的文件（简易匹配）
      const shouldExclude = excludePatterns.some((pattern) => {
        const prefix = pattern.replace("/**", "").replace("/*", "")
        return innerPath.startsWith(prefix + "/") || innerPath === prefix
      })
      if (shouldExclude) {
        continue
      }

      files.push(file)
    }

    setSelectedFiles(files)

    // 从 webkitRelativePath 提取 vault 名称
    if (fileList[0]) {
      const rootName = fileList[0].webkitRelativePath.split("/")[0]
      setVaultName(rootName)
      if (!name.trim()) {
        setName(rootName)
      }
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("请填写显示名称")
      return
    }
    if (selectedFiles.length === 0) {
      setError("请先选择 Vault 文件夹")
      return
    }

    setSaving(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("name", name.trim())
      formData.append(
        "excludePatterns",
        JSON.stringify(excludes.split("\n").map((l) => l.trim()).filter(Boolean))
      )

      const relativePaths: string[] = []
      for (const file of selectedFiles) {
        formData.append("files", file)
        const parts = file.webkitRelativePath.split("/")
        relativePaths.push(parts.slice(1).join("/"))
      }
      formData.append("relativePaths", JSON.stringify(relativePaths))

      const res = await fetch("/api/import/sources/upload", {
        method: "POST",
        body: formData
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "上传失败")
        setSaving(false)
        return
      }

      const { job } = await res.json()
      onCreated(job?.id)
    } catch {
      setError("网络错误")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[480px] rounded-2xl border border-border bg-surface p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold">添加导入来源</h2>

        <div className="mt-6 space-y-5">
          {/* 来源类型 */}
          <div className="space-y-2">
            <label className="text-[13px] text-secondary">来源类型</label>
            <div className="flex h-10 items-center gap-2 rounded-sm border border-border bg-elevated px-3">
              <FolderOpen className="h-4 w-4 text-accent-purple" />
              <span className="text-[13px]">Obsidian Vault</span>
            </div>
          </div>

          {/* 选择文件夹 */}
          <div className="space-y-2">
            <label className="text-[13px] text-secondary">Vault 文件夹</label>
            <input
              ref={inputRef}
              type="file"
              // @ts-expect-error webkitdirectory is non-standard
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-10 w-full items-center gap-2.5 rounded-sm border border-border bg-elevated px-3 text-left transition-colors hover:border-border-hover"
            >
              <Upload className="h-4 w-4 shrink-0 text-muted" />
              {selectedFiles.length > 0 ? (
                <span className="text-[13px]">
                  {vaultName} — {selectedFiles.length} 个文件
                </span>
              ) : (
                <span className="text-[13px] text-muted">点击选择 Vault 文件夹</span>
              )}
            </button>
          </div>

          {/* 名称 */}
          <div className="space-y-2">
            <label className="text-[13px] text-secondary">显示名称</label>
            <Input
              placeholder="例如：Work Notes"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* 排除目录 */}
          <div className="space-y-2">
            <label className="text-[13px] text-secondary">排除目录（每行一个 glob）</label>
            <textarea
              value={excludes}
              onChange={(e) => setExcludes(e.target.value)}
              rows={3}
              className="w-full rounded-sm border border-border bg-elevated px-3 py-2.5 font-mono text-xs text-muted outline-none transition-colors focus:border-primary/40"
            />
          </div>

          {error && (
            <p className="text-xs text-error">{error}</p>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="mt-6 flex justify-end gap-2.5">
          <Button
            variant="secondary"
            onClick={onClose}
            className="h-[38px] rounded-sm px-[18px] text-[13px]"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="h-[38px] rounded-sm bg-accent-blue px-[18px] text-[13px] font-medium text-white hover:bg-accent-blue/90"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                上传中...
              </>
            ) : (
              "添加并开始导入"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
