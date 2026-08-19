import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { NEXT_PARAM, safeNextPath } from '@/lib/auth/auth-routes'
import { getCurrentUser } from '@/lib/auth/current-user'
import { LoginForm } from './login-form'

/**
 * The only screen reachable without a session.
 *
 * It renders outside the app frame - no sidebar, no navigation - because none of
 * those destinations are reachable yet, and offering them would only produce a
 * bounce straight back here.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Đăng nhập',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Already signed in: the login screen has nothing to offer, so go where the
  // link was pointing instead of asking for a password that is not needed.
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  const raw = params[NEXT_PARAM]
  const nextPath = safeNextPath(Array.isArray(raw) ? raw[0] : raw)
  if (user) redirect(nextPath)

  return (
    <div className="flex min-h-svh items-center justify-center px-5 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldCheck aria-hidden className="size-8 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">Kiểm tra khuyến mãi</h1>
          <p className="text-sm text-pretty text-muted-foreground">
            Đăng nhập để dùng công cụ. Tài khoản do người quản trị cấp.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <LoginForm nextPath={nextPath} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Quên mật khẩu thì liên hệ người quản trị để đặt lại.
        </p>
      </div>
    </div>
  )
}
