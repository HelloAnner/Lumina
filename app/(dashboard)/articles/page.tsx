import { ArticlesClient } from "@/components/articles/articles-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { getUiPreferences } from "@/src/server/services/preferences/store"

export default async function ArticlesPage() {
  const user = await requirePageUser()
  const prefs = await getUiPreferences(user.id)
  const result = repository.listArticles(user.id, {
    page: 1,
    pageSize: 20,
    sortBy: prefs.articleSortBy
  })
  const topics = repository.listArticleTopics(user.id)

  return (
    <ArticlesClient
      initialData={result}
      initialTopics={topics}
      initialSortBy={prefs.articleSortBy}
    />
  )
}
