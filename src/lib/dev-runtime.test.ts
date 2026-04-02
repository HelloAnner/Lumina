import { createServer } from "node:net"
import assert from "node:assert/strict"
import test from "node:test"
import {
  buildDevEnvironment,
  buildDevServerArgs,
  buildPortBusyMessage,
  isPortAvailable,
  shouldSyncNodeModules
} from "@/src/lib/dev-runtime"

test("buildDevEnvironment 提供本地热更新所需的默认环境变量", () => {
  const environment = buildDevEnvironment({})

  assert.equal(environment.PORT, "20261")
  assert.equal(environment.APP_URL, "http://localhost:20261")
  assert.equal(
    environment.DATABASE_URL,
    "postgresql://lumina:lumina@localhost:25432/lumina"
  )
  assert.equal(environment.REDIS_URL, "redis://localhost:26379")
  assert.equal(environment.MINIO_ENDPOINT, "http://localhost:29000")
  assert.equal(environment.DATA_DIR, "data/app")
})

test("buildDevEnvironment 保留显式传入的环境变量", () => {
  const environment = buildDevEnvironment({
    PORT: "3100",
    APP_URL: "https://dev.example.com",
    DATABASE_URL: "postgresql://custom",
    REDIS_URL: "redis://custom",
    MINIO_ENDPOINT: "https://minio.example.com",
    DATA_DIR: "/tmp/lumina"
  })

  assert.equal(environment.PORT, "3100")
  assert.equal(environment.APP_URL, "https://dev.example.com")
  assert.equal(environment.DATABASE_URL, "postgresql://custom")
  assert.equal(environment.REDIS_URL, "redis://custom")
  assert.equal(environment.MINIO_ENDPOINT, "https://minio.example.com")
  assert.equal(environment.DATA_DIR, "/tmp/lumina")
})

test("buildDevServerArgs 使用 next dev 的开放监听模式", () => {
  assert.deepEqual(buildDevServerArgs("20261"), [
    "run",
    "dev",
    "--",
    "--hostname",
    "0.0.0.0",
    "--port",
    "20261"
  ])
})

test("isPortAvailable 在端口被占用时返回 false", async () => {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve))

  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("expected tcp server address")
  }

  await assert.doesNotReject(() => isPortAvailable(String(address.port)))
  assert.equal(await isPortAvailable(String(address.port)), false)

  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
})

test("buildPortBusyMessage 给出平和的开发提示", () => {
  assert.equal(
    buildPortBusyMessage("20261"),
    "Port 20261 is already in use. Run `make stop` to close the container stack, or restart with `PORT=20262 make dev`."
  )
})

test("shouldSyncNodeModules 在 lockfile 比已安装状态更新时返回 true", () => {
  assert.equal(
    shouldSyncNodeModules({
      packageLockExists: true,
      installedLockExists: true,
      packageLockMtimeMs: 200,
      installedLockMtimeMs: 100
    }),
    true
  )
})

test("shouldSyncNodeModules 在已安装状态不落后时返回 false", () => {
  assert.equal(
    shouldSyncNodeModules({
      packageLockExists: true,
      installedLockExists: true,
      packageLockMtimeMs: 100,
      installedLockMtimeMs: 200
    }),
    false
  )
})

test("shouldSyncNodeModules 在缺少已安装锁文件时返回 true", () => {
  assert.equal(
    shouldSyncNodeModules({
      packageLockExists: true,
      installedLockExists: false
    }),
    true
  )
})
