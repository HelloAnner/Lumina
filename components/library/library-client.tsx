"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Check,
  ChevronDown,
  Edit3,
  ImagePlus,
  LayoutGrid,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BOOK_COVER_PALETTES,
  PatternBookCoverArt,
  buildBookCoverArtSpec
} from "@/components/library/book-cover-art"
import {
  formatLibraryProgressText,
  normalizeLibraryProgress
} from "@/components/library/library-progress"
import type { Book, BookFormat } from "@/src/server/store/types"
import Image from "next/image"

type LibraryBook = Book & {
  coverUrl?: string
}

/** 极简书籍封面 — 温暖大地色系，以排版为核心 */
function BookCover({
  title,
  coverUrl,
  coverVariant,
  progress,
  isComplete
}: {
  title: string
  coverUrl?: string
  coverVariant?: number
  progress: number
  isComplete: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const palette = buildBookCoverArtSpec(title, coverVariant).palette
  const normalizedProgress = normalizeLibraryProgress(progress)
  const showCover = coverUrl && !imgError

  return (
    <div className="group/cover relative">
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-lg transition-transform duration-300 ease-out group-hover/cover:-translate-y-1"
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
          <PatternBookCoverArt title={title} coverVariant={coverVariant} />
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
  const palette = buildBookCoverArtSpec(book.title, book.coverVariant).palette
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
          <PatternBookCoverArt title={book.title} coverVariant={book.coverVariant} />
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
/** 将 File 转为 base64 data URI */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** 编辑书籍对话框（含封面编辑） */
function EditBookDialog({
  book,
  isOpen,
  onClose,
  onSave
}: {
  book: LibraryBook | null
  isOpen: boolean
  onClose: () => void
  onSave: (bookId: string, data: {
    title: string
    author: string
    format: BookFormat
    tags: string[]
    coverImageBase64?: string
    coverVariant?: number
  }) => void
}) {
  const [title, setTitle] = useState(book?.title || "")
  const [author, setAuthor] = useState(book?.author || "")
  const [format, setFormat] = useState<BookFormat>(book?.format || "EPUB")
  const [tags, setTags] = useState<string[]>(book?.tags || [])
  const [newTag, setNewTag] = useState("")
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverBase64, setCoverBase64] = useState<string | null>(null)
  const [coverVariant, setCoverVariant] = useState(book?.coverVariant || 0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useMemo(() => {
    if (book) {
      setTitle(book.title)
      setAuthor(book.author || "")
      setFormat(book.format)
      setTags(book.tags)
      setCoverPreview(null)
      setCoverBase64(null)
      setCoverVariant(book.coverVariant || 0)
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    setCoverBase64(base64)
    setCoverPreview(base64)
  }

  const handleRefreshVariant = () => {
    const next = (coverVariant + 1) % BOOK_COVER_PALETTES.length
    setCoverVariant(next)
    setCoverPreview(null)
    setCoverBase64(null)
  }

  const handleSave = () => {
    onSave(book.id, {
      title: title.trim() || book.title,
      author: author.trim(),
      format,
      tags,
      ...(coverBase64 ? { coverImageBase64: coverBase64 } : {}),
      coverVariant
    })
    onClose()
  }

  const previewPalette = buildBookCoverArtSpec(
    title.trim() || book.title,
    coverVariant
  ).palette
  const displayCoverUrl = coverPreview || book.coverUrl

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">编辑书籍信息</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 封面编辑区 */}
        <div className="mb-5 flex gap-5">
          <div
            className="relative aspect-[3/4] w-28 flex-shrink-0 overflow-hidden rounded-lg"
            style={{ background: previewPalette.bg }}
          >
            {displayCoverUrl ? (
              <Image
                src={displayCoverUrl}
                alt={book.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <PatternBookCoverArt
                title={title || book.title}
                coverVariant={coverVariant}
              />
            )}
          </div>
          <div className="flex flex-col justify-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-secondary transition-colors hover:bg-elevated hover:text-foreground"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              上传封面
            </button>
            <button
              onClick={handleRefreshVariant}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-secondary transition-colors hover:bg-elevated hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新图案
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
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
    data: {
      title: string
      author: string
      format: BookFormat
      tags: string[]
      coverImageBase64?: string
      coverVariant?: number
    }
  ) {
    const response = await fetch(`/api/books/${bookId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
    if (response.ok) {
      const { item, coverUrl } = await response.json()
      setBooks((current) => current.map((b) => (
        b.id === bookId ? { ...b, ...item, coverUrl: coverUrl || b.coverUrl } : b
      )))
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
                  coverVariant={book.coverVariant}
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
