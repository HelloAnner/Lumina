/**
 * 导入进度页面
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/25
 */
import { ImportProgressClient } from "@/components/import/import-progress-client"
import { requirePageUser } from "@/src/server/lib/session"
import { repository } from "@/src/server/repositories"
import { notFound } from "next/navigation"

interface Props {
  params: Promise<{ jobId: string }>
}

export default async function ImportProgressPage({ params }: Props) {
  const user = await requirePageUser()
  const { jobId } = await params
  const job = repository.getImportJob(user.id, jobId)
  if (!job) {
    notFound()
  }

  const source = repository.getImportSource(user.id, job.sourceId)

  return (
    <ImportProgressClient
      initialJob={job}
      sourceName={source?.name ?? "未知来源"}
    />
  )
}
