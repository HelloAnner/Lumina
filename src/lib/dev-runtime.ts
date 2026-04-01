import { createServer } from "node:net"

const DEFAULT_PORT = "20261"
const DEFAULT_DATABASE_URL = "postgresql://lumina:lumina@localhost:25432/lumina"
const DEFAULT_REDIS_URL = "redis://localhost:26379"
const DEFAULT_MINIO_ENDPOINT = "http://localhost:29000"
const DEFAULT_DATA_DIR = "data/app"
const DEFAULT_JWT_SECRET = "lumina-dev-secret"
const DEFAULT_DEMO_EMAIL = "demo@lumina.local"
const DEFAULT_DEMO_PASSWORD = "lumina123"
const DEFAULT_MINIO_USER = "lumina"
const DEFAULT_MINIO_PASSWORD = "lumina123456"

export function buildDevEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const port = environment.PORT?.trim() || DEFAULT_PORT

  return {
    ...environment,
    PORT: port,
    APP_URL: environment.APP_URL || `http://localhost:${port}`,
    DATA_DIR: environment.DATA_DIR || DEFAULT_DATA_DIR,
    DATABASE_URL: environment.DATABASE_URL || DEFAULT_DATABASE_URL,
    REDIS_URL: environment.REDIS_URL || DEFAULT_REDIS_URL,
    MINIO_ENDPOINT: environment.MINIO_ENDPOINT || DEFAULT_MINIO_ENDPOINT,
    MINIO_ROOT_USER: environment.MINIO_ROOT_USER || DEFAULT_MINIO_USER,
    MINIO_ROOT_PASSWORD:
      environment.MINIO_ROOT_PASSWORD || DEFAULT_MINIO_PASSWORD,
    JWT_SECRET: environment.JWT_SECRET || DEFAULT_JWT_SECRET,
    DEFAULT_DEMO_EMAIL: environment.DEFAULT_DEMO_EMAIL || DEFAULT_DEMO_EMAIL,
    DEFAULT_DEMO_PASSWORD:
      environment.DEFAULT_DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD
  }
}

export function buildDevServerArgs(port: string) {
  return ["run", "dev", "--", "--hostname", "0.0.0.0", "--port", port]
}

export function buildPortBusyMessage(port: string) {
  return `Port ${port} is already in use. Run \`make stop\` to close the container stack, or restart with \`PORT=20262 make dev\`.`
}

export async function isPortAvailable(port: string) {
  return new Promise<boolean>((resolve, reject) => {
    const server = createServer()

    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve(false)
        return
      }
      reject(error)
    })

    server.once("listening", () => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(true)
      })
    })

    server.listen(Number(port), "0.0.0.0")
  })
}
