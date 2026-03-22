import { LibraryClient } from "@/components/library/library-client"
import { requirePageUser } from "@/src/server/lib/session"
import { listBooksFromStore } from "@/src/server/services/books/store"

export default async function LibraryPage() {
  const user = await requirePageUser()
  const books = await listBooksFromStore(user.id)
  return <LibraryClient initialBooks={books} />
}
