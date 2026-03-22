import { SettingsClient } from "@/components/settings/settings-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"

export default async function SettingsPage() {
  const user = await requirePageUser()
  return (
    <SettingsClient
      modelConfigs={repository.listModelConfigs(user.id)}
      readerSettings={repository.getReaderSettings(user.id)}
      storageConfig={repository.getStorageConfig(user.id)}
      user={user}
    />
  )
}
