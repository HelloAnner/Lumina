import { Client } from "minio"

const DEFAULT_BUCKET = "lumina-books"
const clientRegistry = new Map<string, Client>()
const ensuredBuckets = new Set<string>()

interface StorageRuntimeConfig {
  endpoint?: string
  accessKey?: string
  secretKey?: string
  bucket?: string
}

function getMinioConfig(runtimeConfig?: StorageRuntimeConfig) {
  const endpointUrl =
    runtimeConfig?.endpoint || process.env.MINIO_ENDPOINT || "http://localhost:29000"
  const url = new URL(endpointUrl)
  return {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
    useSSL: url.protocol === "https:",
    accessKey: runtimeConfig?.accessKey || process.env.MINIO_ROOT_USER || "lumina",
    secretKey: runtimeConfig?.secretKey || process.env.MINIO_ROOT_PASSWORD || "lumina123456"
  }
}

function getClient(runtimeConfig?: StorageRuntimeConfig) {
  const key = JSON.stringify(getMinioConfig(runtimeConfig))
  if (!clientRegistry.has(key)) {
    clientRegistry.set(key, new Client(getMinioConfig(runtimeConfig)))
  }
  return clientRegistry.get(key)!
}

async function ensureBucket(bucket: string, runtimeConfig?: StorageRuntimeConfig) {
  const bucketKey = `${bucket}:${JSON.stringify(getMinioConfig(runtimeConfig))}`
  if (ensuredBuckets.has(bucketKey)) {
    return
  }
  const client = getClient(runtimeConfig)
  const exists = await client.bucketExists(bucket)
  if (!exists) {
    await client.makeBucket(bucket)
  }
  ensuredBuckets.add(bucketKey)
}

export async function uploadBookObject(params: {
  userId: string
  bookId: string
  fileName: string
  buffer: Buffer
  contentType: string
  runtimeConfig?: StorageRuntimeConfig
}) {
  const bucket = params.runtimeConfig?.bucket || process.env.MINIO_BUCKET || DEFAULT_BUCKET
  await ensureBucket(bucket, params.runtimeConfig)
  const objectName = `books/${params.userId}/${params.bookId}/${params.fileName}`
  await getClient(params.runtimeConfig).putObject(bucket, objectName, params.buffer, params.buffer.length, {
    "Content-Type": params.contentType
  })
  return {
    bucket,
    objectName
  }
}

export async function removeBookObject(
  bucket: string,
  objectName: string,
  runtimeConfig?: StorageRuntimeConfig
) {
  if (!bucket || !objectName) {
    return
  }
  try {
    await getClient(runtimeConfig).removeObject(bucket, objectName)
  } catch {
    return
  }
}

export async function getBookObjectUrl(
  bucket: string,
  objectName: string,
  runtimeConfig?: StorageRuntimeConfig
) {
  if (!bucket || !objectName) {
    return ""
  }
  return getClient(runtimeConfig).presignedGetObject(bucket, objectName, 60 * 15)
}

export async function uploadCoverImage(params: {
  userId: string
  bookId: string
  imageBase64: string
  runtimeConfig?: StorageRuntimeConfig
}) {
  const bucket = params.runtimeConfig?.bucket || process.env.MINIO_BUCKET || DEFAULT_BUCKET
  await ensureBucket(bucket, params.runtimeConfig)

  const base64Data = params.imageBase64.replace(/^data:image\/\w+;base64,/, "")
  const buffer = Buffer.from(base64Data, "base64")

  const extMatch = params.imageBase64.match(/^data:image\/(\w+);base64,/)
  const ext = extMatch ? extMatch[1] : "jpg"
  const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`

  const objectName = `covers/${params.userId}/${params.bookId}.${ext}`
  await getClient(params.runtimeConfig).putObject(bucket, objectName, buffer, buffer.length, {
    "Content-Type": contentType
  })

  return {
    bucket,
    objectName
  }
}
