import { ArticlesClient } from "@/components/articles/articles-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { cachedRepo } from "@/src/server/repositories/cached"
import { getUiPreferences } from "@/src/server/services/preferences/store"

export default async function ArticlesPage() {
  const user = await requirePageUser()
  const fullUser = repository.getUserById(user.id)
  const prefs = await getUiPreferences(user.id)
  const [result, topics] = await Promise.all([
    cachedRepo.listArticles(user.id, {
      page: 1,
      pageSize: 20,
      sortBy: prefs.articleSortBy
    }),
    cachedRepo.listArticleTopics(user.id)
  ])

  return (
    <ArticlesClient
      initialData={result}
      initialTopics={topics}
      initialSortBy={prefs.articleSortBy}
      archiveRetentionDays={fullUser?.archiveRetentionDays ?? 30}
    />
  )
}
