import { PublishClient } from "@/components/publish/publish-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"

export default async function PublishPage() {
  const user = await requirePageUser()
  const tasks = repository.listPublishTasks(user.id)
  return (
    <PublishClient
      initialRecords={tasks[0] ? repository.listPublishRecords(tasks[0].id) : []}
      targets={repository.listPublishTargets(user.id)}
      tasks={tasks}
      viewpoints={repository.listViewpoints(user.id)}
    />
  )
}
