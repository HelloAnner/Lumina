import test from "node:test"
import assert from "node:assert/strict"

test("ensureServerRuntimeStarted 只会启动后台服务一次", async () => {
  const bootstrap = await import("./bootstrap")

  bootstrap.resetServerRuntimeForTests()

  let started = 0
  bootstrap.ensureServerRuntimeStarted({
    startScoutScheduler() {
      started += 1
    }
  })
  bootstrap.ensureServerRuntimeStarted({
    startScoutScheduler() {
      started += 1
    }
  })

  assert.equal(started, 1)

  bootstrap.resetServerRuntimeForTests()
})
