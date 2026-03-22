import Link from "next/link"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getCurrentSession } from "@/src/server/lib/auth"

export default async function LoginPage() {
  const session = await getCurrentSession()
  if (session?.sub) {
    redirect("/library")
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md border-border bg-surface/95">
        <CardHeader className="space-y-3">
          <div className="text-2xl font-semibold">登录 Lumina</div>
          <p className="text-sm leading-6 text-secondary">
            默认演示账号：demo@lumina.local / lumina123
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm type="login" />
          <p className="text-sm text-secondary">
            还没有账号？
            <Link className="ml-2 text-primary" href="/register">
              立即注册
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
