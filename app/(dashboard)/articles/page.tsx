import { ArticlesClient } from "@/components/articles/articles-client"
import { requirePageUser } from "@/src/server/lib/session"
import { cachedRepo } from "@/src/server/repositories/cached"
import { getUiPreferences } from "@/src/server/services/preferences/store"

export default async function ArticlesPage({
  searchParams
}: {
  searchParams?: {
    sourceId?: string | string[]
  }
}) {
  const user = await requirePageUser()
  const prefs = await getUiPreferences(user.id)
  const sourceIdParam = Array.isArray(searchParams?.sourceId)
    ? searchParams?.sourceId[0]
    : searchParams?.sourceId

  const [folders, articles] = await Promise.all([
    cachedRepo.listArticleSourceFolders(user.id),
    sourceIdParam
      ? cachedRepo.listArticles(user.id, {
          sourceId: sourceIdParam,
          sortBy: prefs.articleSortBy,
          all: true
        })
      : Promise.resolve({ items: [] })
  ])

  return (
    <ArticlesClient
      initialFolders={folders}
      initialArticles={articles.items}
      initialSourceId={sourceIdParam ?? null}
    />
  )
}
