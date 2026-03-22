import type { User } from "@/src/server/store/types"

export interface AppEnv {
  Variables: {
    userId: string
    user: User
  }
}
