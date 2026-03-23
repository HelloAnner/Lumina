import { notFound } from "next/navigation"
import { ReaderClient } from "@/components/reader/reader-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { getReaderProgress } from "@/src/server/services/books/progress"
import { getBookFromStore } from "@/src/server/services/books/store"
import { getUiPreferences } from "@/src/server/services/preferences/store"

export default async function ReaderPage({
  params
}: {
  params: { bookId: string }
}) {
  const user = await requirePageUser()
  const book = await getBookFromStore(user.id, params.bookId)
  if (!book) {
    notFound()
  }
  return (
    <ReaderClient
      book={book}
      highlights={repository.listHighlightsByBook(user.id, book.id)}
      initialProgress={await getReaderProgress(user.id, book.id)}
      initialWidths={await getUiPreferences(user.id)}
      settings={repository.getReaderSettings(user.id)}
    />
  )
}
