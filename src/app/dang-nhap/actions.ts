'use server'

/**
 * Signing in and signing out.
 *
 * A failed attempt never says which half was wrong: "no such user" and "wrong
 * password" would together let anyone list who has an account here.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LOGIN_PATH, NEXT_PARAM, safeNextPath } from '@/lib/auth/auth-routes'
import { attemptLogin } from '@/lib/auth/login'
import type { LoginFormState } from '@/lib/auth/login-form-state'
import { createSession, deleteSession } from '@/lib/auth/session-store'
import { SESSION_COOKIE_NAME, sessionCookieAttributes } from '@/lib/auth/session-cookie'

const WRONG_CREDENTIALS = 'Tên đăng nhập hoặc mật khẩu không đúng.'

export async function loginAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const identifier = String(formData.get('identifier') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const destination = safeNextPath(String(formData.get(NEXT_PARAM) ?? ''))

  if (identifier === '' || password === '') {
    return { status: 'error', message: 'Nhập đủ tên đăng nhập và mật khẩu.', identifier }
  }

  const outcome = await attemptLogin(identifier, password)
  if (!outcome.ok) {
    const message =
      outcome.reason === 'locked'
        ? `Sai mật khẩu quá nhiều lần nên tài khoản bị tạm khoá. Thử lại sau ${outcome.minutesLeft} phút.`
        : WRONG_CREDENTIALS
    return { status: 'error', message, identifier }
  }

  const session = await createSession(outcome.user.id)
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, session.token, sessionCookieAttributes(session.expiresAt))

  // redirect() signals by throwing, so it has to stay outside any try/catch.
  redirect(destination)
}

export async function logoutAction(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (token) await deleteSession(token)
  // Cleared as well as deleted server-side: otherwise the browser keeps sending
  // a dead cookie and the middleware keeps waving it through to a 401.
  store.delete(SESSION_COOKIE_NAME)
  redirect(LOGIN_PATH)
}
