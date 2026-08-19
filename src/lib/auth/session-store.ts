import { getAppConfig } from '@/lib/config/app-config'
import { prisma } from '@/lib/db/prisma'
import { createSessionToken, hashSessionToken } from './session-token'

/**
 * Session rows: create, look up, delete.
 *
 * Every function takes or returns the raw token; only this module knows that the
 * database stores its hash.
 */

/** What a screen is allowed to know about whoever is logged in. */
export type AuthenticatedUser = {
  id: string
  username: string
  email: string
}

export type CreatedSession = {
  token: string
  expiresAt: Date
}

export async function createSession(userId: string): Promise<CreatedSession> {
  const { authSessionTtlHours } = await getAppConfig()
  const token = createSessionToken()
  const expiresAt = new Date(Date.now() + authSessionTtlHours * 60 * 60 * 1000)

  await prisma.session.create({
    data: { tokenHash: hashSessionToken(token), userId, expiresAt },
  })
  // Opportunistic sweep: expired rows are dead weight, and this is the only
  // moment the table is written often enough to be worth piggybacking on.
  await deleteExpiredSessions()

  return { token, expiresAt }
}

/**
 * Resolves a cookie token to its user, or null when the session is unknown or
 * past its expiry.
 *
 * Expiry is compared here rather than trusted from the cookie: the cookie's own
 * lifetime is a hint the browser may ignore, this timestamp is the real one.
 */
export async function findSessionUser(token: string): Promise<AuthenticatedUser | null> {
  if (token === '') return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, username: true, email: true } },
    },
  })
  if (!session) return null
  if (session.expiresAt.getTime() <= Date.now()) {
    // Burn it on the way out rather than leaving it for the next sweep.
    await deleteSession(token)
    return null
  }
  return session.user
}

export async function deleteSession(token: string): Promise<void> {
  if (token === '') return
  // deleteMany, not delete: logging out twice must not throw on a row that the
  // first call already removed.
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
}

/** Used when a password changes: every other browser has to sign in again. */
export async function deleteUserSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } })
  return count
}

export async function deleteExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  return count
}
