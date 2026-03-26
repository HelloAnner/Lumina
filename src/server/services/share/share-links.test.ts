/**
 * 分享链接服务测试
 *
 * @author Anner
 * @since 0.3.0
 * Created on 2026/3/26
 */
import test from "node:test"
import assert from "node:assert/strict"

import {
  buildShareUrl,
  pickLanIpv4,
  resolveShareExpiration,
  shareLinkExpired
} from "@/src/server/services/share/share-links"

test("buildShareUrl 在 80 端口时省略端口号", () => {
  const url = buildShareUrl(
    { host: "192.168.31.18", port: 80 },
    "token-demo"
  )

  assert.equal(url, "http://192.168.31.18/share/token-demo")
})

test("buildShareUrl 在自定义端口时保留端口号", () => {
  const url = buildShareUrl(
    { host: "192.168.31.18", port: 20261 },
    "token-demo"
  )

  assert.equal(url, "http://192.168.31.18:20261/share/token-demo")
})

test("pickLanIpv4 优先返回局域网 IPv4", () => {
  const address = pickLanIpv4([
    "127.0.0.1",
    "8.8.8.8",
    "192.168.31.18",
    "10.0.0.8"
  ])

  assert.equal(address, "192.168.31.18")
})

test("resolveShareExpiration 支持永久有效", () => {
  const expiresAt = resolveShareExpiration("never", new Date("2026-03-26T00:00:00.000Z"))

  assert.equal(expiresAt, null)
})

test("shareLinkExpired 能识别已过期链接", () => {
  assert.equal(
    shareLinkExpired("2026-03-25T00:00:00.000Z", new Date("2026-03-26T00:00:00.000Z")),
    true
  )
  assert.equal(
    shareLinkExpired("2026-03-27T00:00:00.000Z", new Date("2026-03-26T00:00:00.000Z")),
    false
  )
})

