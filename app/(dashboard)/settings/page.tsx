import { SettingsClient } from "@/components/settings/settings-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"

export default async function SettingsPage() {
  const user = await requirePageUser()

  // 获取导入来源及统计
  const importSources = repository.listImportSources(user.id).map((source) => {
    const notes = repository.listImportedNotes(user.id, source.id)
    const imageCount = notes.reduce((sum, n) => sum + n.imageKeys.length, 0)
    const links = notes.flatMap((n) => repository.listNoteViewpointLinks(n.id))
    const viewpointIds = new Set(links.map((l) => l.viewpointId))
    return {
      ...source,
      stats: {
        noteCount: notes.length,
        imageCount,
        viewpointCount: viewpointIds.size
      }
    }
  })

  return (
    <SettingsClient
      modelBindings={repository.listModelBindings(user.id)}
      modelConfigs={repository.listModelConfigs(user.id)}
      readerSettings={repository.getReaderSettings(user.id)}
      shareEndpointConfig={repository.getShareEndpointConfig()}
      importSources={importSources}
      user={user}
    />
  )
}
