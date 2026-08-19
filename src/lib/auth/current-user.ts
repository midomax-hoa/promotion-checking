import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LOGIN_PATH } from './auth-routes'
import { findSessionUser, type AuthenticatedUser } from './session-store'
import { SESSION_COOKIE_NAME } from './session-cookie'

/**
 * The real access check.
 *
 * The middleware only sees whether a cookie exists; it runs on the Edge runtime
 * and cannot reach the database. Every page, API route and server action
 * therefore calls one of these before doing anything, so a forged or expired
 * cookie is caught where the data actually lives.
 */

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  return token ? findSessionUser(token) : null
}

/** For pages and server actions: no session means the login screen, not an error. */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser()
  if (!user) redirect(LOGIN_PATH)
  return user
}

/**
 * API routes cannot redirect to an HTML login page and have it mean anything, so
 * they check `getCurrentUser()` themselves and answer with this instead.
 */
export function unauthorizedResponse(): Response {
  return Response.json({ error: 'Cần đăng nhập để dùng chức năng này.' }, { status: 401 })
}
