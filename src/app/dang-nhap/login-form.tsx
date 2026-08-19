'use client'

/**
 * The login form itself.
 *
 * A client component only because it needs `useActionState` for the pending
 * state and the error message; the page around it stays a Server Component.
 */

import { useActionState } from 'react'
import { LogIn } from 'lucide-react'
import { loginAction } from '@/app/dang-nhap/actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NEXT_PARAM } from '@/lib/auth/auth-routes'
import { INITIAL_LOGIN_STATE } from '@/lib/auth/login-form-state'

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_LOGIN_STATE)

  return (
    // noValidate: the server owns the wording, in Vietnamese.
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.status === 'error' ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {/* Where the visitor was headed before being sent here. */}
      <input type="hidden" name={NEXT_PARAM} value={nextPath} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="identifier" className="text-sm font-medium">
          Tên đăng nhập hoặc email
        </label>
        <Input
          id="identifier"
          name="identifier"
          // "username" rather than "email": the box accepts either, and a
          // password manager offered the wrong one fills in the wrong field.
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          defaultValue={state.identifier ?? ''}
          aria-invalid={state.status === 'error' || undefined}
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Mật khẩu
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.status === 'error' || undefined}
          className="h-9"
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        <LogIn aria-hidden />
        {pending ? 'Đang kiểm tra...' : 'Đăng nhập'}
      </Button>
    </form>
  )
}
