import { spawn, spawnSync } from "node:child_process"
import { stat } from "node:fs/promises"
import {
  buildDevEnvironment,
  buildDevServerArgs,
  buildPortBusyMessage,
  isPortAvailable,
  shouldSyncNodeModules
} from "@/src/lib/dev-runtime"

async function readMtimeMs(path: string) {
  try {
    const file = await stat(path)
    return file.mtimeMs
  } catch {
    return undefined
  }
}

async function syncDependenciesIfNeeded() {
  const packageLockMtimeMs = await readMtimeMs("package-lock.json")
  const installedLockMtimeMs = await readMtimeMs("node_modules/.package-lock.json")

  if (
    !shouldSyncNodeModules({
      packageLockExists: packageLockMtimeMs !== undefined,
      installedLockExists: installedLockMtimeMs !== undefined,
      packageLockMtimeMs,
      installedLockMtimeMs
    })
  ) {
    return
  }

  console.log("[lumina] syncing npm dependencies with package-lock.json")

  const result = spawnSync("npm", ["ci"], {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit"
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

async function start() {
  await syncDependenciesIfNeeded()

  const environment = buildDevEnvironment(process.env)
  const port = environment.PORT || "20261"

  if (!(await isPortAvailable(port))) {
    console.error(`[lumina] ${buildPortBusyMessage(port)}`)
    process.exit(1)
  }

  const child = spawn("npm", buildDevServerArgs(port), {
    cwd: process.cwd(),
    env: environment,
    shell: process.platform === "win32",
    stdio: "inherit"
  })

  child.once("error", (error) => {
    console.error(`[lumina] failed to start dev server: ${error.message}`)
    process.exit(1)
  })

  child.once("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

void start()
