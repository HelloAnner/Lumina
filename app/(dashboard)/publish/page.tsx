import { PublishClient } from "@/components/publish/publish-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { cachedRepo } from "@/src/server/repositories/cached"

export default async function PublishPage() {
  const user = await requirePageUser()
  const [tasks, targets, viewpoints] = await Promise.all([
    cachedRepo.listPublishTasks(user.id),
    cachedRepo.listPublishTargets(user.id),
    cachedRepo.listViewpoints(user.id)
  ])
  return (
    <PublishClient
      initialRecords={tasks[0] ? repository.listPublishRecords(tasks[0].id) : []}
      targets={targets}
      tasks={tasks}
      viewpoints={viewpoints}
    />
  )
}
