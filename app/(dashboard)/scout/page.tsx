import { ScoutClient } from "@/components/scout/scout-client"
import { requirePageUser } from "@/src/server/lib/session"
import { cachedRepo } from "@/src/server/repositories/cached"
import { repository } from "@/src/server/repositories"

export default async function ScoutPage() {
  const user = await requirePageUser()
  const [tasks, patches, sources, viewpoints] = await Promise.all([
    cachedRepo.listTasks(user.id),
    cachedRepo.listPatches(user.id),
    cachedRepo.listSources(user.id),
    cachedRepo.listViewpoints(user.id)
  ])

  const { items: articles } = repository.listArticles(user.id, {
    page: 1,
    pageSize: 50,
    sortBy: "created"
  })

  return (
    <ScoutClient
      initialTasks={tasks}
      initialPatches={patches}
      initialSources={sources}
      initialViewpoints={viewpoints}
      initialArticles={articles}
    />
  )
}
