import PDFDocument from "pdfkit"
import { decryptValue } from "@/src/server/lib/crypto"
import { repository } from "@/src/server/repositories"
import type { PublishTask } from "@/src/server/store/types"

function renderTaskContent(userId: string, task: PublishTask) {
  const viewpoints = task.viewpointIds
    .map((viewpointId) => repository.getViewpoint(userId, viewpointId))
    .filter(Boolean)

  return viewpoints
    .map((viewpoint) => `# ${viewpoint!.title}\n\n${viewpoint!.articleContent}`)
    .join("\n\n---\n\n")
}

export async function exportTaskAsPdf(content: string) {
  const document = new PDFDocument({ margin: 40 })
  const chunks: Buffer[] = []
  document.on("data", (chunk) => chunks.push(chunk))
  document.on("error", () => undefined)
  document.fontSize(12).fillColor("black").text(content, {
    width: 500,
    lineGap: 4
  })
  document.end()
  await new Promise<void>((resolve) => document.on("end", () => resolve()))
  return Buffer.concat(chunks)
}

export async function triggerPublish(userId: string, taskId: string) {
  const task = repository.listPublishTasks(userId).find((item) => item.id === taskId)
  if (!task) {
    return null
  }
  const target = repository
    .listPublishTargets(userId)
    .find((item) => item.id === task.targetId)
  const content = renderTaskContent(userId, task)

  try {
    if (target?.endpointUrl?.startsWith("http")) {
      await fetch(target.endpointUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: target.authHeader ? decryptValue(target.authHeader) : ""
        },
        body: JSON.stringify({
          title: task.name,
          format: task.format,
          content
        })
      })
    }
    return repository.createPublishRecord({
      taskId: task.id,
      triggeredBy: "manual",
      status: "SUCCESS",
      content
    })
  } catch (error) {
    return repository.createPublishRecord({
      taskId: task.id,
      triggeredBy: "manual",
      status: "FAILED",
      errorMsg: error instanceof Error ? error.message : "Unknown publish error",
      content
    })
  }
}

export function renderTaskContentById(userId: string, taskId: string) {
  const task = repository.listPublishTasks(userId).find((item) => item.id === taskId)
  if (!task) {
    return ""
  }
  return renderTaskContent(userId, task)
}
