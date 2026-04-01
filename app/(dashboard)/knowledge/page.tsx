import { KnowledgeClient } from "@/components/knowledge/knowledge-client"
import { readKnowledgeSelection } from "@/components/knowledge/knowledge-url-state"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { cachedRepo } from "@/src/server/repositories/cached"
import { getUiPreferences } from "@/src/server/services/preferences/store"
import type { Viewpoint } from "@/src/server/store/types"

export default async function KnowledgePage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const user = await requirePageUser()
  const viewpoints = await cachedRepo.listViewpoints(user.id, { metadataOnly: true })
  const selection = readKnowledgeSelection(buildSearchParams(searchParams))
  const importedNote = selection.importedNoteId
    ? repository.getImportedNote(user.id, selection.importedNoteId)
    : undefined
  const selectedViewpoint = importedNote
    ? undefined
    : selection.viewpointId
      ? await cachedRepo.getViewpoint(user.id, selection.viewpointId, { includeBlocks: true })
      : await cachedRepo.getViewpoint(user.id, viewpoints[0]?.id ?? "", { includeBlocks: true })
  const selected = importedNote
    ? undefined
    : resolveSelectedViewpoint(
        viewpoints,
        selectedViewpoint
      )
  const [unconfirmed, readerSettings, uiPrefs] = await Promise.all([
    selected
      ? cachedRepo.listUnconfirmedHighlights(user.id, selected.id)
      : Promise.resolve([]),
    cachedRepo.getReaderSettings(user.id),
    getUiPreferences(user.id)
  ])

  return (
    <KnowledgeClient
      initialImportedNoteId={importedNote?.id}
      keyboardShortcuts={readerSettings?.keyboardShortcuts}
      initialWidths={uiPrefs}
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
  selected?: Viewpoint
) {
  if (!selected) {
    return undefined
  }
  const summary = viewpoints.find((item) => item.id === selected.id)
  if (!summary) {
    return selected
  }
  return {
    ...summary,
    ...selected
  }
}
