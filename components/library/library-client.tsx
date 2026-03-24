"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  Edit3,
  Plus,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  formatLibraryProgressText,
  normalizeLibraryProgress
} from "@/components/library/library-progress"
import type { Book, BookFormat } from "@/src/server/store/types"
import Image from "next/image"

type LibraryBook = Book & {
  coverUrl?: string
}

/** 根据书名哈希生成封面色系，保证同一本书颜色稳定 */
const COVER_THEMES = [
  { from: "#6d28d9", to: "#4338ca" },  // 紫蓝
  { from: "#0369a1", to: "#0e7490" },  // 深蓝青
  { from: "#065f46", to: "#0f766e" },  // 深绿
  { from: "#9a3412", to: "#b45309" },  // 橙红
  { from: "#86198f", to: "#be185d" },  // 紫粉
  { from: "#1e3a5f", to: "#1d4ed8" },  // 海军蓝
  { from: "#374151", to: "#1f2937" },  // 深石墨
  { from: "#7c2d12", to: "#dc2626" },  // 深红
  { from: "#14532d", to: "#166534" },  // 墨绿
  { from: "#312e81", to: "#5b21b6" },  // 靛紫
]

function hashTitle(title: string): number {
  let h = 5381
  for (let i = 0; i < title.length; i++) {
    h = ((h << 5) + h) ^ title.charCodeAt(i)
  }
  return Math.abs(h)
}

function BookCover({
  title,
  author,
  format,
  coverUrl
}: {
  title: string
  author?: string
  format?: string
  coverUrl?: string
}) {
  if (coverUrl) {
    return (
      <div className="relative h-[178px] w-[118px] overflow-hidden rounded-[14px] border border-border bg-elevated shadow-lg">
        <Image
          src={coverUrl}
          alt={`${title} 封面`}
          width={118}
          height={178}
          className="h-full w-full object-cover"
          unoptimized
        />
      </div>
    )
  }

  const theme = COVER_THEMES[hashTitle(title) % COVER_THEMES.length]

  return (
    <div
      className="relative h-[178px] w-[118px] overflow-hidden rounded-[14px] shadow-lg"
      style={{ background: `linear-gradient(145deg, ${theme.from}, ${theme.to})` }}
    >
      {/* 书脊效果 */}
      <div className="absolute left-0 top-0 h-full w-[5px] bg-black/25" />

      {/* 装饰圆环 */}
      <div
        className="absolute rounded-full border border-white/10"
        style={{ width: 80, height: 80, top: -20, right: -20 }}
      />
      <div
        className="absolute rounded-full border border-white/10"
        style={{ width: 52, height: 52, bottom: 10, left: -14 }}
      />
      <div
        className="absolute rounded-full bg-white/5"
        style={{ width: 36, height: 36, top: 24, right: 10 }}
      />

      {/* 格式标签 */}
      {format && (
        <div className="absolute right-2.5 top-2.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/60 backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.2)" }}>
          {format}
        </div>
      )}

      {/* 主文字区域 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-3 pt-8 text-center">
        <div className="line-clamp-4 text-[13px] font-bold leading-snug tracking-tight text-white drop-shadow-sm">
          {title}
        </div>
        {author && author !== "未知作者" && (
          <div className="mt-2 line-clamp-1 text-[10px] font-normal text-white/60">
            {author}
          </div>
        )}
      </div>

      {/* 底部装饰线 */}
      <div className="absolute bottom-0 left-5 right-5 h-px bg-white/10" />
    </div>
  )
}

// 编辑对话框组件
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

  // 当 book 变化时更新表单
  useMemo(() => {
    if (book) {
      setTitle(book.title)
      setAuthor(book.author || "")
      setFormat(book.format)
      setTags(book.tags)
    }
  }, [book])

  if (!isOpen || !book) return null

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
          {/* 书名 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">书名</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入书名"
            />
          </div>

          {/* 作者 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">作者</label>
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="输入作者"
            />
          </div>

          {/* 格式 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">格式</label>
            <div className="flex gap-2">
              {(["EPUB", "PDF"] as BookFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-lg px-4 py-2 text-sm transition-all ${
                    format === f
                      ? "bg-primary text-white"
                      : "bg-elevated text-secondary hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* 标签 */}
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
              {tags.map((tag) => (
                <Badge key={tag} className="flex items-center gap-1 pr-1">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 rounded-full p-0.5 hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </div>
      </div>
    </div>
  )
}

export function LibraryClient({ initialBooks }: { initialBooks: LibraryBook[] }) {
  const router = useRouter()
  const [books, setBooks] = useState(initialBooks)
  const [query, setQuery] = useState("")
  const [tag, setTag] = useState("")
  const [editingBook, setEditingBook] = useState<LibraryBook | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const tags = useMemo(
    () => Array.from(new Set(initialBooks.flatMap((item) => item.tags))),
    [initialBooks]
  )

  const filtered = useMemo(() => {
    return books.filter((item) => {
      if (query && !`${item.title} ${item.author ?? ""}`.includes(query)) {
        return false
      }
      if (tag && !item.tags.includes(tag)) {
        return false
      }
      return true
    })
  }, [books, query, tag])

  async function removeBook(bookId: string) {
    await fetch(`/api/books/${bookId}`, {
      method: "DELETE"
    })
    setBooks((current) => current.filter((item) => item.id !== bookId))
    router.refresh()
  }

  async function handleEditBook(book: LibraryBook) {
    setEditingBook(book)
    setIsEditOpen(true)
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
      setBooks((current) =>
        current.map((book) =>
          book.id === bookId
            ? { ...book, ...item }
            : book
        )
      )
      router.refresh()
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-base">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/60 px-8 py-5">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold tracking-tight">书库</h1>
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-1.5 text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              书籍 {books.length}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-1.5 text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary/60" />
              标签 {tags.length}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="gap-2">
            <Plus className="h-4 w-4" />
            新建分类
          </Button>
          <Button onClick={() => router.push("/library/upload")} className="gap-2">
            <Upload className="h-4 w-4" />
            上传
          </Button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="flex items-center justify-between border-b border-border/60 px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="w-72 pl-10"
              placeholder="搜索书名、作者"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="h-5 w-px bg-border/60" />
          <div className="flex flex-wrap gap-2">
            <Button
              variant={tag ? "secondary" : "ghost"}
              onClick={() => setTag("")}
              className="text-sm"
            >
              全部
            </Button>
            {tags.map((item) => (
              <Button
                key={item}
                variant={tag === item ? "secondary" : "ghost"}
                onClick={() => setTag(item)}
                className="text-sm"
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted">细长书脊视图</div>
      </div>

      {/* Book Grid */}
      <div className="flex-1 p-8">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-8 gap-y-10">
          {filtered.map((book) => (
            <Card
              key={book.id}
              className="group border-transparent bg-transparent shadow-none hover:border-transparent hover:shadow-none"
            >
              <button
                className="flex w-full flex-col items-center text-left"
                onClick={() => router.push(`/reader/${book.id}`)}
              >
                <div className="transition-transform duration-300 ease-out group-hover:-translate-y-2">
                  <BookCover title={book.title} author={book.author} format={book.format} coverUrl={book.coverUrl} />
                </div>
              </button>
              <CardContent className="space-y-2.5 px-1 pb-0 pt-4">
                <div className="space-y-1 text-center">
                  <div className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
                    {book.title}
                  </div>
                  <div className="text-xs text-muted">{book.author || "未知作者"}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>阅读进度</span>
                    <span className="font-medium text-foreground">
                      {formatLibraryProgressText(book.readProgress)}
                    </span>
                  </div>
                  <Progress value={normalizeLibraryProgress(book.readProgress)} />
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>{book.lastReadAt ? "最近打开" : "等待阅读"}</span>
                    <span>{book.lastReadAt ? "已有阅读记录" : "进度为 0"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {book.tags.slice(0, 3).map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button
                    className="inline-flex items-center text-xs text-muted transition-colors hover:text-foreground"
                    onClick={() => router.push(`/reader/${book.id}`)}
                  >
                    继续阅读
                    <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditBook(book)}
                      className="h-7 w-7 p-0"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBook(book.id)}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      <EditBookDialog
        book={editingBook}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleSaveBook}
      />
    </div>
  )
}
