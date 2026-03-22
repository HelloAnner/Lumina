import { notFound } from "next/navigation"
import { ReaderClient } from "@/components/reader/reader-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { getBookFromStore } from "@/src/server/services/books/store"

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
      settings={repository.getReaderSettings(user.id)}
    />
  )
}
