import Link from "next/link"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getCurrentSession } from "@/src/server/lib/auth"

export default async function RegisterPage() {
  const session = await getCurrentSession()
  if (session?.sub) {
    redirect("/library")
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md border-border bg-surface/95">
        <CardHeader className="space-y-3">
          <div className="text-2xl font-semibold">创建账号</div>
          <p className="text-sm leading-6 text-secondary">
            完成注册后即可进入全部模块，当前环境默认启用本地持久化。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm type="register" />
          <p className="text-sm text-secondary">
            已有账号？
            <Link className="ml-2 text-primary" href="/login">
              返回登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
