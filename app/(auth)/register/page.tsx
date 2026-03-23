import Link from "next/link"
import { redirect } from "next/navigation"
import { UserPlus } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentSession } from "@/src/server/lib/auth"

export default async function RegisterPage() {
  const session = await getCurrentSession()
  if (session?.sub) {
    redirect("/library")
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-elevated">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">创建账号</h1>
          <p className="mt-2 text-sm text-muted">开始您的阅读之旅</p>
        </div>

        <Card className="border-border/60 bg-surface">
          <CardContent className="pt-6">
            <LoginForm type="register" />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted">
          已有账号？
          <Link className="ml-1.5 font-medium text-foreground hover:underline" href="/login">
            返回登录
          </Link>
        </p>

        <p className="mt-8 text-center text-xs text-muted/60">
          完成注册后即可进入全部模块
        </p>
      </div>
    </main>
  )
}
