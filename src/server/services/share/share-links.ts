/**
 * 分享链接服务
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os"
import { randomBytes } from "node:crypto"
import type {
  ShareDurationOption,
  ShareEndpointConfig
} from "@/src/server/store/types"

function isPrivateIpv4(address: string) {
  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  )
}

export function pickLanIpv4(addresses: string[]) {
  const candidates = addresses.filter((item) => /^\d{1,3}(\.\d{1,3}){3}$/.test(item))
  const privateAddress = candidates.find((item) => isPrivateIpv4(item))
  if (privateAddress) {
    return privateAddress
  }
  const externalAddress = candidates.find((item) => item !== "127.0.0.1")
  if (externalAddress) {
    return externalAddress
  }
  return "127.0.0.1"
}

export function detectLanIpv4(
  interfacesMap: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()
) {
  const addresses = Object.values(interfacesMap)
    .flat()
    .filter((item): item is NetworkInterfaceInfo => Boolean(item))
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => item.address)
  return pickLanIpv4(addresses)
}

export function getDefaultShareEndpointConfig(): ShareEndpointConfig {
  return {
    host: detectLanIpv4(),
    port: 80
  }
}

export function buildShareUrl(config: ShareEndpointConfig, token: string) {
  const host = config.host.trim()
  const portPart = config.port === 80 ? "" : `:${config.port}`
  return `http://${host}${portPart}/share/${token}`
}

export function resolveShareExpiration(
  option: ShareDurationOption,
  nowDate: Date = new Date()
) {
  if (option === "never") {
    return null
  }
  const next = new Date(nowDate)
  if (option === "24h") {
    next.setHours(next.getHours() + 24)
  } else if (option === "7d") {
    next.setDate(next.getDate() + 7)
  } else {
    next.setDate(next.getDate() + 30)
  }
  return next.toISOString()
}

export function shareLinkExpired(expiresAt?: string | null, nowDate: Date = new Date()) {
  if (!expiresAt) {
    return false
  }
  return new Date(expiresAt).getTime() <= nowDate.getTime()
}

export function createShareToken() {
  return randomBytes(18).toString("base64url")
}

export function buildPublicSharePdfFileUrl(token: string) {
  return `/api/shares/public/${token}/file`
}

export function buildPublicSharePdfPageImageUrl(token: string, pageNumber: number) {
  return `/api/shares/public/${token}/page-images/${pageNumber}`
}
