/**
 * 信息源管理页面
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/25
 */
import { SourcesClient } from "@/components/sources/sources-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { BUILTIN_CHANNELS } from "@/src/server/services/scout/builtin-channels"

export default async function SourcesPage() {
  const user = await requirePageUser()

  const userChannels = repository.listChannels(user.id).filter((ch) => ch.origin === "user")
  const builtinChannels = BUILTIN_CHANNELS.map((ch) => ({
    ...ch,
    id: `builtin-${ch.name.replace(/\s+/g, "-").toLowerCase()}`,
    createdAt: ""
  }))
  const channels = [...builtinChannels, ...userChannels]
  const sources = repository.listSources(user.id)
  const credentials = repository.listCredentials(user.id)

  return (
    <SourcesClient
      initialChannels={channels}
      initialSources={sources}
      credentials={credentials}
    />
  )
}
