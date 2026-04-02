import { scoutScheduler } from "@/src/server/services/scout/scheduler"

let runtimeStarted = false

export function ensureServerRuntimeStarted(deps: {
  startScoutScheduler?: () => void
} = {}) {
  if (runtimeStarted) {
    return
  }

  runtimeStarted = true
  ;(deps.startScoutScheduler ?? (() => scoutScheduler.start()))()
}

export function resetServerRuntimeForTests() {
  runtimeStarted = false
}
