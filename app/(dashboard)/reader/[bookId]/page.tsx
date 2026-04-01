import { notFound } from "next/navigation"
import { ReaderClient } from "@/components/reader/reader-client"
import { requirePageUser } from "@/src/server/lib/session"
import { cachedRepo } from "@/src/server/repositories/cached"
import { getReaderProgress } from "@/src/server/services/books/progress"
import { repairStoredBook } from "@/src/server/services/books/book-repair"
import { getBookFromStore } from "@/src/server/services/books/store"
import {
  getReaderLayoutState,
  getUiPreferences
} from "@/src/server/services/preferences/store"

export default async function ReaderPage({
  params
}: {
  params: { bookId: string }
}) {
  const user = await requirePageUser()
  const storedBook = await getBookFromStore(user.id, params.bookId)
  const book = storedBook ? await repairStoredBook(storedBook) : null
  if (!book) {
    notFound()
  }
  const [highlights, progress, widths, layout, settings] = await Promise.all([
    cachedRepo.listHighlightsByBook(user.id, book.id),
    getReaderProgress(user.id, book.id),
    getUiPreferences(user.id),
    getReaderLayoutState(user.id, "book", book.id),
    cachedRepo.getReaderSettings(user.id)
  ])
  return (
    <ReaderClient
      book={book}
      highlights={highlights}
      initialProgress={progress}
      initialWidths={widths}
      initialLayout={layout}
      settings={settings}
    />
  )
}
