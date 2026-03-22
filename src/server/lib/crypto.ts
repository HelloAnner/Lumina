import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto"

function getKey() {
  return createHash("sha256")
    .update(process.env.JWT_SECRET ?? "lumina-dev-secret")
    .digest()
}

export function encryptValue(value: string) {
  if (!value) {
    return ""
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf-8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptValue(value: string) {
  if (!value) {
    return ""
  }
  const buffer = Buffer.from(value, "base64")
  const iv = buffer.subarray(0, 12)
  const tag = buffer.subarray(12, 28)
  const encrypted = buffer.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf-8"
  )
}
