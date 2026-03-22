import { Sidebar } from "@/components/layout/sidebar"
import { requirePageUser } from "@/src/server/lib/session"

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  await requirePageUser()

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />
      <main className="min-h-screen flex-1">{children}</main>
    </div>
  )
}
