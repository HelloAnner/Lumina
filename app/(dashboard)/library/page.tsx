import { LibraryClient } from "@/components/library/library-client"
import { requirePageUser } from "@/src/server/lib/session"
import { getStoredObjectUrl } from "@/src/server/services/books/minio"
import { listBooksFromStore } from "@/src/server/services/books/store"

export default async function LibraryPage() {
  const user = await requirePageUser()
  const books = await listBooksFromStore(user.id)
  const booksWithCoverUrl = await Promise.all(
    books.map(async (book) => ({
      ...book,
      coverUrl: await getStoredObjectUrl(book.coverPath)
    }))
  )
  return <LibraryClient initialBooks={booksWithCoverUrl} />
}
