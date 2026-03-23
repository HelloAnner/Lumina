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
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div className="flex gap-3 text-xs text-secondary">
          <div className="rounded-full border border-border px-3 py-1">书籍 {books.length}</div>
          <div className="rounded-full border border-border px-3 py-1">标签 {tags.length}</div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary">
            <Plus className="mr-2 h-4 w-4" />
            新建分类
          </Button>
          <Button onClick={() => router.push("/library/upload")}>
            <Upload className="mr-2 h-4 w-4" />
            上传 EPUB
          </Button>
        </div>
      </header>
      <div className="flex items-center justify-between border-b border-border px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <Input
              className="w-72 pl-9"
              placeholder="搜索书名、作者"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={tag ? "secondary" : "ghost"} onClick={() => setTag("")}>
              全部
            </Button>
            {tags.map((item) => (
              <Button
                key={item}
                variant={tag === item ? "secondary" : "ghost"}
                onClick={() => setTag(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
        <div className="text-xs text-secondary">细长书脊视图</div>
      </div>
      <div className="flex-1 p-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-5 gap-y-8">
          {filtered.map((book) => (
            <Card key={book.id} className="border-transparent bg-transparent shadow-none hover:border-transparent hover:shadow-none">
              <button
                className="group flex w-full flex-col items-center text-left"
                onClick={() => router.push(`/reader/${book.id}`)}
              >
                <div className="transition duration-200 group-hover:-translate-y-1">
                  <BookCover title={book.title} coverUrl={book.coverUrl} />
                </div>
              </button>
              <CardContent className="space-y-2 px-2 pb-0 pt-4">
                <div className="space-y-1 text-center">
                  <div className="line-clamp-2 text-sm font-medium leading-5">{book.title}</div>
                  <div className="text-xs text-secondary">{book.author}</div>
                </div>
                <div className="space-y-2">
                  <Progress value={book.readProgress * 100} />
                  <div className="flex items-center justify-between text-xs text-secondary">
                    <span>{formatPercent(book.readProgress)}</span>
                    <span>{book.lastReadAt ? "刚刚阅读" : "尚未开始"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {book.tags.map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button
                    className="inline-flex items-center text-xs text-secondary transition hover:text-foreground"
                    onClick={() => router.push(`/reader/${book.id}`)}
                  >
                    继续阅读
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </button>
                  <Button variant="ghost" onClick={() => removeBook(book.id)}>
                    <Trash2 className="h-4 w-4" />
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
