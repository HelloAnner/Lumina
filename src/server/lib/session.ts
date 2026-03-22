import { redirect } from "next/navigation"
import { getCurrentSession } from "@/src/server/lib/auth"
import { repository } from "@/src/server/repositories"

export async function requirePageUser() {
  const session = await getCurrentSession()
  if (!session?.sub) {
    redirect("/login")
  }
  const user = repository.getUserById(session.sub)
  if (!user) {
    redirect("/login")
  }
  return user
}
