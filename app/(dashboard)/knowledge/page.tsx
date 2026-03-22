import { KnowledgeClient } from "@/components/knowledge/knowledge-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { getUiPreferences } from "@/src/server/services/preferences/store"

export default async function KnowledgePage() {
  const user = await requirePageUser()
  const viewpoints = repository.listViewpoints(user.id)
  const selected = viewpoints[0]
  const unconfirmed = selected
    ? repository.listUnconfirmedHighlights(user.id, selected.id)
    : []

  return (
    <KnowledgeClient
      initialWidths={await getUiPreferences(user.id)}
      initialSelected={selected}
      initialViewpoints={viewpoints}
      unconfirmed={unconfirmed as never}
    />
  )
}
