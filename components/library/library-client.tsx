"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Check,
  ChevronDown,
  Edit3,
  LayoutGrid,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  formatLibraryProgressText,
  normalizeLibraryProgress
} from "@/components/library/library-progress"
import type { Book, BookFormat } from "@/src/server/store/types"
import Image from "next/image"

type LibraryBook = Book & {
  coverUrl?: string
}

/**
 * 封面配色方案 - 低饱和度克制色系
 * 每组：背景色、装饰线色、文字色
 */
const COVER_PALETTES = [
  { bg: "#13131A", accent: "#6C8EEF", text: "#BFC8F5" },
  { bg: "#131E1E", accent: "#4EB5A8", text: "#B8E8E4" },
  { bg: "#201916", accent: "#C87D50", text: "#E8C4A0" },
  { bg: "#17141F", accent: "#9B8EC4", text: "#CCC5E8" },
  { bg: "#131820", accent: "#5B8FD4", text: "#B0CDF0" },
  { bg: "#1E1910", accent: "#C4943A", text: "#E8D0A0" },
  { bg: "#121B14", accent: "#6BC89B", text: "#B4E4C8" },
  { bg: "#1C1318", accent: "#C47090", text: "#E8B8CC" },
]

function hashTitle(title: string): number {
  let h = 5381
  for (let i = 0; i < title.length; i++) {
    h = ((h << 5) + h) ^ title.charCodeAt(i)
  }
  return Math.abs(h)
}

/** 生成封面装饰图案（基于哈希确定性选择） */
function CoverPattern({ hash, accent }: { hash: number; accent: string }) {
  const variant = hash % 4
  const accentDim = accent + "18"
  const accentMid = accent + "30"

  if (variant === 0) {
    // 右下角大圆弧
    return (
      <div
        className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full"
        style={{ border: `1.5px solid ${accentMid}`, background: accentDim }}
      />
    )
  }
  if (variant === 1) {
    // 对角线
    return (
      <>
        <div className="absolute right-5 top-5 h-px w-14" style={{ background: accentMid }} />
        <div className="absolute right-5 top-5 h-14 w-px" style={{ background: accentMid }} />
      </>
    )
  }
  if (variant === 2) {
    // 底部横条纹
    return (
      <div className="absolute bottom-6 left-5 right-5 flex flex-col gap-[5px]">
        <div className="h-px" style={{ background: accentMid }} />
        <div className="h-px w-3/4" style={{ background: accentDim }} />
        <div className="h-px w-1/2" style={{ background: accentDim }} />
      </div>
    )
  }
  // 右上角小菱形
  return (
    <div
      className="absolute right-5 top-6 h-8 w-8 rotate-45"
      style={{ border: `1px solid ${accentMid}` }}
    />
  )
}

/** 极简书籍封面 */
function BookCover({
  title,
  coverUrl,
  progress,
  isComplete
}: {
  title: string
  coverUrl?: string
  progress: number
  isComplete: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const hash = hashTitle(title)
  const palette = COVER_PALETTES[hash % COVER_PALETTES.length]
  const normalizedProgress = normalizeLibraryProgress(progress)
  const showCover = coverUrl && !imgError

  return (
    <div className="group/cover relative">
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-lg shadow-panel transition-transform duration-300 ease-out group-hover/cover:-translate-y-1"
        style={{ background: palette.bg }}
      >
        {showCover ? (
          <Image
            src={coverUrl}
            alt={title}
            fill
            className="object-cover"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <>
            {/* 装饰图案 */}
            <CoverPattern hash={hash} accent={palette.accent} />
            {/* 顶部装饰线 */}
            <div
              className="absolute left-5 top-5 h-[2px] w-8 rounded-full"
              style={{ background: palette.accent }}
            />
            {/* 书名 */}
            <div className="absolute inset-x-5 bottom-5 top-10 flex flex-col justify-end">
              <p
                className="line-clamp-4 text-[15px] font-semibold leading-[1.4]"
                style={{ color: palette.text }}
              >
                {title}
              </p>
            </div>
          </>
        )}

        {/* 已读完标记 */}
        {isComplete && (
          <div className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-success">
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        )}

        {/* 底部进度条 */}
        {normalizedProgress > 0 && !isComplete && (
          <div
            className="absolute bottom-0 left-0 h-[2px]"
            style={{ width: `${normalizedProgress}%`, background: palette.accent }}
          />
        )}
      </div>
    </div>
  )
}

/** 继续阅读 - 精选横向卡片 */
function ContinueReadingCard({
  book,
  onClick
}: {
  book: LibraryBook
  onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const hash = hashTitle(book.title)
  const palette = COVER_PALETTES[hash % COVER_PALETTES.length]
  const normalizedProgress = normalizeLibraryProgress(book.readProgress)
  const showCover = book.coverUrl && !imgError

  return (
    <button
      onClick={onClick}
      className="group flex w-full overflow-hidden rounded-2xl bg-surface transition-colors hover:bg-elevated"
    >
      {/* 封面 */}
      <div
        className="relative h-[180px] w-[130px] flex-shrink-0 overflow-hidden"
        style={{ background: palette.bg }}
      >
        {showCover ? (
          <Image
            src={book.coverUrl!}
            alt={book.title}
            width={130}
            height={180}
            className="h-full w-full object-cover"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <>
            <CoverPattern hash={hash} accent={palette.accent} />
            <div
              className="absolute left-4 top-4 h-[2px] w-6 rounded-full"
              style={{ background: palette.accent }}
            />
            <div className="absolute inset-x-4 bottom-4 top-8 flex flex-col justify-end">
              <p
                className="line-clamp-3 text-[13px] font-semibold leading-[1.4]"
                style={{ color: palette.text }}
              >
                {book.title}
              </p>
            </div>
          </>
        )}
      </div>

      {/* 信息 */}
      <div className="flex flex-1 flex-col justify-center gap-3 px-7 py-6">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            {book.title}
          </h3>
          <p className="mt-1 text-[13px] text-secondary">
            {book.author || "未知作者"}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-[3px] w-[120px] overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${normalizedProgress}%` }}
              />
            </div>
            <span className="text-xs font-medium text-primary">
              {normalizedProgress}%
            </span>
          </div>
          {book.lastReadAt && (
            <span className="text-xs text-muted">
              {formatLastRead(book.lastReadAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-secondary transition-colors group-hover:text-foreground">
          继续阅读
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </button>
  )
}

/** 格式化上次阅读时间 */
function formatLastRead(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return "今天阅读"
  }
  if (diffDays === 1) {
    return "昨天阅读"
  }
  if (diffDays < 7) {
    return `${diffDays}天前阅读`
  }
  if (diffDays < 30) {
    return `${Math.floor(diffDays / 7)}周前阅读`
  }
  return `${Math.floor(diffDays / 30)}月前阅读`
}

/** 编辑书籍对话框 */
function EditBookDialog({
  book,
  isOpen,
  onClose,
  onSave
}: {
  book: LibraryBook | null
  isOpen: boolean
  onClose: () => void
  onSave: (bookId: string, data: { title: string; author: string; format: BookFormat; tags: string[] }) => void
}) {
  const [title, setTitle] = useState(book?.title || "")
  const [author, setAuthor] = useState(book?.author || "")
  const [format, setFormat] = useState<BookFormat>(book?.format || "EPUB")
  const [tags, setTags] = useState<string[]>(book?.tags || [])
  const [newTag, setNewTag] = useState("")

  useMemo(() => {
    if (book) {
      setTitle(book.title)
      setAuthor(book.author || "")
      setFormat(book.format)
      setTags(book.tags)
    }
  }, [book])

  if (!isOpen || !book) {
    return null
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  const handleSave = () => {
    onSave(book.id, { title: title.trim() || book.title, author: author.trim(), format, tags })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">编辑书籍信息</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">书名</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="输入书名" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">作者</label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="输入作者" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">格式</label>
            <div className="flex gap-2">
              {(["EPUB", "PDF"] as BookFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-lg px-4 py-2 text-sm transition-all ${
                    format === f ? "bg-primary text-white" : "bg-elevated text-secondary hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">标签</label>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="添加标签"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
              />
              <Button variant="secondary" onClick={handleAddTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Badge key={t} className="flex items-center gap-1 pr-1">
                  {t}
                  <button onClick={() => handleRemoveTag(t)} className="ml-1 rounded-full p-0.5 hover:bg-overlay">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </div>
      </div>
    </div>
  )
}

type TabFilter = "all" | "reading" | "done" | "unread"

export function LibraryClient({ initialBooks }: { initialBooks: LibraryBook[] }) {
  const router = useRouter()
  const [books, setBooks] = useState(initialBooks)
  const [query, setQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [tab, setTab] = useState<TabFilter>("all")
  const [editingBook, setEditingBook] = useState<LibraryBook | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  /** 最近阅读的书（用于继续阅读区域） */
  const lastReadBook = useMemo(() => {
    return books
      .filter((b) => b.readProgress > 0 && b.readProgress < 1 && b.lastReadAt)
      .sort((a, b) => new Date(b.lastReadAt!).getTime() - new Date(a.lastReadAt!).getTime())[0]
  }, [books])

  /** 按标签过滤后的书籍 */
  const filtered = useMemo(() => {
    return books.filter((book) => {
      if (query && !`${book.title} ${book.author ?? ""}`.toLowerCase().includes(query.toLowerCase())) {
        return false
      }
      if (tab === "reading" && !(book.readProgress > 0 && book.readProgress < 1)) {
        return false
      }
      if (tab === "done" && !(book.readProgress >= 1)) {
        return false
      }
      if (tab === "unread" && !(book.readProgress === 0 || !book.readProgress)) {
        return false
      }
      return true
    })
  }, [books, query, tab])

  async function removeBook(bookId: string) {
    await fetch(`/api/books/${bookId}`, { method: "DELETE" })
    setBooks((current) => current.filter((b) => b.id !== bookId))
    router.refresh()
  }

  async function handleSaveBook(
    bookId: string,
    data: { title: string; author: string; format: BookFormat; tags: string[] }
  ) {
    const response = await fetch(`/api/books/${bookId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
    if (response.ok) {
      const { item } = await response.json()
      setBooks((current) => current.map((b) => (b.id === bookId ? { ...b, ...item } : b)))
      router.refresh()
    }
  }

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "reading", label: "阅读中" },
    { key: "done", label: "已读完" },
    { key: "unread", label: "未开始" },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-base">
      {/* 简洁头部 */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-end gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            书库
          </h1>
          <span className="mb-0.5 text-sm text-muted">
            {books.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* 搜索 */}
          {showSearch ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  autoFocus
                  className="h-9 w-64 rounded-lg border border-border bg-surface/50 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-secondary"
                  placeholder="搜索书名、作者..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button
                onClick={() => { setShowSearch(false); setQuery("") }}
                className="rounded-lg p-2 text-muted hover:text-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="rounded-lg p-2 text-muted hover:text-secondary"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
          )}

          <button className="rounded-lg p-2 text-muted hover:text-secondary">
            <LayoutGrid className="h-[18px] w-[18px]" />
          </button>

          <Button
            onClick={() => router.push("/library/upload")}
            className="ml-1 h-[34px] gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-3.5 w-3.5" />
            上传
          </Button>
        </div>
      </header>

      {/* 主内容 */}
      <div className="flex-1 overflow-y-auto px-8 pb-12">
        {/* 继续阅读 */}
        {lastReadBook && !query && tab === "all" && (
          <section className="mb-8">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">
              继续阅读
            </h2>
            <ContinueReadingCard
              book={lastReadBook}
              onClick={() => router.push(`/reader/${lastReadBook.id}`)}
            />
          </section>
        )}

        {/* 间距 */}
        {lastReadBook && !query && tab === "all" && <div className="h-6" />}

        {/* 网格标签过滤 */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  tab === t.key
                    ? "bg-overlay font-medium text-foreground"
                    : "text-muted hover:text-secondary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1 text-xs text-muted hover:text-secondary">
            最近阅读
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 书籍网格 */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-8">
          {filtered.map((book) => (
            <div key={book.id} className="group relative">
              {/* 封面 */}
              <button
                className="block w-full text-left"
                onClick={() => router.push(`/reader/${book.id}`)}
              >
                <BookCover
                  title={book.title}
                  coverUrl={book.coverUrl}
                  progress={book.readProgress}
                  isComplete={book.readProgress >= 1}
                />
              </button>

              {/* 悬浮操作按钮 */}
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => { setEditingBook(book); setIsEditOpen(true) }}
                  className="rounded-md bg-surface/80 p-1.5 text-secondary backdrop-blur-sm hover:text-foreground"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => removeBook(book.id)}
                  className="rounded-md bg-surface/80 p-1.5 text-secondary backdrop-blur-sm hover:text-error"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* 书名和作者 */}
              <div className="mt-2.5 space-y-0.5">
                <p className="line-clamp-1 text-[13px] font-medium text-foreground">
                  {book.title}
                </p>
                <p className="text-[11px] text-muted">
                  {book.author || "未知作者"}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 空状态 */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-sm text-muted">
              {query ? "没有找到匹配的书籍" : "书库为空"}
            </p>
            {!query && (
              <Button
                onClick={() => router.push("/library/upload")}
                variant="secondary"
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                上传第一本书
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 编辑对话框 */}
      <EditBookDialog
        book={editingBook}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleSaveBook}
      />
    </div>
  )
}
