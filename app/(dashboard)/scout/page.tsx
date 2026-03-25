import { ScoutClient } from "@/components/scout/scout-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"

export default async function ScoutPage() {
  const user = await requirePageUser()
  const tasks = repository.listTasks(user.id)
  const patches = repository.listPatches(user.id)
  const sources = repository.listSources(user.id)
  const viewpoints = repository.listViewpoints(user.id)

  return (
    <ScoutClient
      initialTasks={tasks}
      initialPatches={patches}
      initialSources={sources}
      initialViewpoints={viewpoints}
    />
  )
}
