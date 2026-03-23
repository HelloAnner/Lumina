import Link from "next/link"
import { redirect } from "next/navigation"
import { Sparkles } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getCurrentSession } from "@/src/server/lib/auth"

export default async function LoginPage() {
  const session = await getCurrentSession()
  if (session?.sub) {
    redirect("/library")
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-elevated">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">登录 Lumina</h1>
          <p className="mt-2 text-sm text-muted">智能阅读知识库</p>
        </div>

        <Card className="border-border/60 bg-surface">
          <CardContent className="pt-6">
            <LoginForm type="login" />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted">
          还没有账号？
          <Link className="ml-1.5 font-medium text-foreground hover:underline" href="/register">
            立即注册
          </Link>
        </p>

        <p className="mt-8 text-center text-xs text-muted/60">
          默认演示账号：demo@lumina.local / lumina123
        </p>
      </div>
    </main>
  )
}
