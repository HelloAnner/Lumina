import { UploadPageClient } from "@/components/library/upload-page-client"
import { requirePageUser } from "@/src/server/lib/session"

export default async function UploadBookPage() {
  await requirePageUser()
  return <UploadPageClient />
}
