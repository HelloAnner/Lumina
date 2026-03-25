import { ArticlesClient } from "@/components/articles/articles-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"

export default async function ArticlesPage() {
  const user = await requirePageUser()
  const result = repository.listArticles(user.id, { page: 1, pageSize: 20 })
  const topics = repository.listArticleTopics(user.id)

  return (
    <ArticlesClient
      initialData={result}
      initialTopics={topics}
    />
  )
}
