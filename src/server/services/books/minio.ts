import { Client } from "minio"

const DEFAULT_BOOK_BUCKET = "lumina-books"
const DEFAULT_COVER_BUCKET = "lumina-covers"
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

export function buildBookObjectName(userId: string, bookId: string, fileName: string) {
  return `books/${userId}/${bookId}/${fileName}`
}

export function buildCoverObjectName(userId: string, bookId: string) {
  return `${userId}/${bookId}.jpg`
}

export function formatMinioPath(bucket: string, objectName: string) {
  return `minio://${bucket}/${objectName}`
}

export function parseMinioPath(value?: string) {
  if (!value) {
    return null
  }
  const matched = value.match(/^minio:\/\/([^/]+)\/(.+)$/)
  if (!matched) {
    return null
  }
  return {
    bucket: matched[1],
    objectName: matched[2]
  }
}

function getBookBucket(runtimeConfig?: StorageRuntimeConfig) {
  return runtimeConfig?.bucket || process.env.MINIO_BUCKET || DEFAULT_BOOK_BUCKET
}

function getCoverBucket(runtimeConfig?: StorageRuntimeConfig) {
  return process.env.MINIO_COVER_BUCKET || DEFAULT_COVER_BUCKET
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
  const bucket = getBookBucket(params.runtimeConfig)
  await ensureBucket(bucket, params.runtimeConfig)
  const objectName = buildBookObjectName(params.userId, params.bookId, params.fileName)
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

export async function getBookObjectBuffer(
  bucket: string,
  objectName: string,
  runtimeConfig?: StorageRuntimeConfig
) {
  if (!bucket || !objectName) {
    return null
  }
  const stream = await getClient(runtimeConfig).getObject(bucket, objectName)
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on("end", () => resolve())
    stream.on("error", reject)
  })
  return Buffer.concat(chunks)
}

export async function getStoredObjectUrl(
  storedPath?: string,
  runtimeConfig?: StorageRuntimeConfig
) {
  const parsed = parseMinioPath(storedPath)
  if (!parsed) {
    return ""
  }
  return getBookObjectUrl(parsed.bucket, parsed.objectName, runtimeConfig)
}

export async function getStoredObjectBuffer(
  storedPath?: string,
  runtimeConfig?: StorageRuntimeConfig
) {
  const parsed = parseMinioPath(storedPath)
  if (!parsed) {
    return null
  }
  return getBookObjectBuffer(parsed.bucket, parsed.objectName, runtimeConfig)
}

export async function uploadCoverImage(params: {
  userId: string
  bookId: string
  imageBase64: string
  runtimeConfig?: StorageRuntimeConfig
}) {
  const bucket = getCoverBucket(params.runtimeConfig)
  await ensureBucket(bucket, params.runtimeConfig)

  const base64Data = params.imageBase64.replace(/^data:image\/[\w.+-]+;base64,/, "")
  const buffer = Buffer.from(base64Data, "base64")
  const contentType =
    params.imageBase64.match(/^data:(image\/[\w.+-]+);base64,/)?.[1] || "image/jpeg"
  const objectName = buildCoverObjectName(params.userId, params.bookId)
  await getClient(params.runtimeConfig).putObject(bucket, objectName, buffer, buffer.length, {
    "Content-Type": contentType
  })

  return {
    bucket,
    objectName
  }
}
