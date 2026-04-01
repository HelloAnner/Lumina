/**
 * 信息源管理页面
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
import { SourcesClient } from "@/components/sources/sources-client"
import { requirePageUser } from "@/src/server/lib/session"
import { cachedRepo } from "@/src/server/repositories/cached"
import { BUILTIN_CHANNELS } from "@/src/server/services/scout/builtin-channels"

export default async function SourcesPage() {
  const user = await requirePageUser()

  const [userChannels, sources, credentials] = await Promise.all([
    cachedRepo.listChannels(user.id),
    cachedRepo.listSources(user.id),
    cachedRepo.listCredentials(user.id)
  ])

  const builtinChannels = BUILTIN_CHANNELS.map((ch) => ({
    ...ch,
    id: `builtin-${ch.name.replace(/\s+/g, "-").toLowerCase()}`,
    createdAt: ""
  }))
  const channels = [
    ...builtinChannels,
    ...userChannels.filter((ch: any) => ch.origin === "user")
  ]

  return (
    <SourcesClient
      initialChannels={channels}
      initialSources={sources}
      credentials={credentials}
    />
  )
}
