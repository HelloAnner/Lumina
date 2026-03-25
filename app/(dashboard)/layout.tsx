import { Sidebar } from "@/components/layout/sidebar"
import { requirePageUser } from "@/src/server/lib/session"

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  await requirePageUser()

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
