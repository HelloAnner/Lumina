import { spawn } from "node:child_process"
import {
  buildDevEnvironment,
  buildDevServerArgs,
  buildPortBusyMessage,
  isPortAvailable
} from "@/src/lib/dev-runtime"

async function start() {
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
