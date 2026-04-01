import dynamic from "next/dynamic"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { cachedRepo } from "@/src/server/repositories/cached"

const SettingsClient = dynamic(
  () => import("@/components/settings/settings-client").then((m) => m.SettingsClient),
  { ssr: false }
)

export default async function SettingsPage() {
  const user = await requirePageUser()

  const [modelBindings, modelConfigs, readerSettings, importSources] = await Promise.all([
    cachedRepo.listModelBindings(user.id),
    cachedRepo.listModelConfigs(user.id),
    cachedRepo.getReaderSettings(user.id),
    cachedRepo.listImportSources(user.id)
  ])

  // 获取导入来源统计
  const sourcesWithStats = importSources.map((source) => {
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
      modelBindings={modelBindings}
      modelConfigs={modelConfigs}
      readerSettings={readerSettings}
      shareEndpointConfig={repository.getShareEndpointConfig()}
      importSources={sourcesWithStats}
      user={user}
    />
  )
}
