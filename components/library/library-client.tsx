"use client"
import Image from "next/image"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Plus, Search, Trash2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import type { Book } from "@/src/server/store/types"
import { formatPercent } from "@/src/lib/utils"

type LibraryBook = Book & {
  coverUrl?: string
}

function BookCover({ title, coverUrl }: { title: string; coverUrl?: string }) {
  if (coverUrl) {
    return (
      <div className="relative h-[178px] w-[118px] overflow-hidden rounded-[14px] border border-white/10 bg-[#111827] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
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

  return (
    <div className="flex h-[178px] w-[118px] items-end justify-start rounded-[14px] border border-white/10 bg-gradient-to-br from-primary/60 via-[#33204f] to-[#0f172a] p-3 text-left shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
      <div className="line-clamp-3 text-sm font-semibold leading-5 text-white">
        {title}
      </div>
    </div>
  )
}

export function LibraryClient({ initialBooks }: { initialBooks: LibraryBook[] }) {
  const router = useRouter()
  const [books, setBooks] = useState(initialBooks)
  const [query, setQuery] = useState("")
  const [tag, setTag] = useState("")

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
            上传 EPUB
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-10">
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
                  <BookCover title={book.title} coverUrl={book.coverUrl} />
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
                  <Progress value={book.readProgress * 100} />
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>{formatPercent(book.readProgress)}</span>
                    <span>{book.lastReadAt ? "刚刚阅读" : "尚未开始"}</span>
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
                  <Button variant="ghost" size="sm" onClick={() => removeBook(book.id)} className="h-7 w-7 p-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
