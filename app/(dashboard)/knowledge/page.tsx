import { KnowledgeClient } from "@/components/knowledge/knowledge-client"
import { readKnowledgeSelection } from "@/components/knowledge/knowledge-url-state"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { getUiPreferences } from "@/src/server/services/preferences/store"
import type { Viewpoint } from "@/src/server/store/types"

export default async function KnowledgePage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const user = await requirePageUser()
  const viewpoints = repository.listViewpoints(user.id)
  const selection = readKnowledgeSelection(buildSearchParams(searchParams))
  const importedNote = selection.importedNoteId
    ? repository.getImportedNote(user.id, selection.importedNoteId)
    : undefined
  const selected = importedNote
    ? undefined
    : resolveSelectedViewpoint(viewpoints, selection.viewpointId)
  const unconfirmed = selected
    ? repository.listUnconfirmedHighlights(user.id, selected.id)
    : []

  return (
    <KnowledgeClient
      initialImportedNoteId={importedNote?.id}
      initialWidths={await getUiPreferences(user.id)}
      initialSelected={selected}
      initialViewpoints={viewpoints}
      unconfirmed={unconfirmed as never}
    />
  )
}

function buildSearchParams(
  searchParams?: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string") {
      params.set(key, value)
    }
  }
  return params
}

function resolveSelectedViewpoint(
  viewpoints: Viewpoint[],
  viewpointId?: string
) {
  if (!viewpointId) {
    return viewpoints[0]
  }
  return viewpoints.find((item) => item.id === viewpointId) ?? viewpoints[0]
}
