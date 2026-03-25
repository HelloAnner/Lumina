import { ArticlesClient } from "@/components/articles/articles-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"

export default async function ArticlesPage() {
  const user = await requirePageUser()
  const articles = repository.listArticles(user.id)
  const topics = repository.listArticleTopics(user.id)

  return (
    <ArticlesClient
      initialArticles={articles}
      initialTopics={topics}
    />
  )
}
