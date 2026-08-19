import { randomBytes } from 'node:crypto'
import { getAppConfig } from '@/lib/config/app-config'
import { prisma } from '@/lib/db/prisma'
import { hashPassword, verifyPassword } from './password'
import type { AuthenticatedUser } from './session-store'
import { normalizeUsername } from './user-identity'

/**
 * Checking a username-or-email plus password, with a temporary lock after too
 * many wrong tries.
 *
 * The lock lives on the user row rather than in memory: the container is
 * restarted on every deploy, and an attacker should not get a fresh allowance
 * for free.
 */

export type LoginOutcome =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'locked'; minutesLeft: number }

/**
 * A real hash to compare against when the account does not exist.
 *
 * Without it an unknown username answers in a millisecond while a known one
 * takes the full scrypt cost, which is enough of a difference to enumerate who
 * has an account. Built once, lazily, from throwaway bytes nobody can match.
 */
let dummyHash: Promise<string> | null = null
function unmatchableHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(32).toString('base64'))
  return dummyHash
}

export async function attemptLogin(identifier: string, password: string): Promise<LoginOutcome> {
  const { authMaxFailedAttempts, authLockoutMinutes } = await getAppConfig()
  // Both columns are stored lower-cased, so one normalised value matches either.
  const value = normalizeUsername(identifier)

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: value }, { email: value }] },
  })

  if (!user) {
    await verifyPassword(password, await unmatchableHash())
    return { ok: false, reason: 'invalid' }
  }

  const lockedFor = remainingLockMinutes(user.lockedUntil)
  if (lockedFor > 0) return { ok: false, reason: 'locked', minutesLeft: lockedFor }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failedAttempts = user.failedAttempts + 1
    const reachedLimit = failedAttempts >= authMaxFailedAttempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Counter resets together with the lock, so the next window starts clean
        // instead of locking again on the very first mistake after it lifts.
        failedAttempts: reachedLimit ? 0 : failedAttempts,
        lockedUntil: reachedLimit ? new Date(Date.now() + authLockoutMinutes * 60_000) : null,
      },
    })
    return reachedLimit
      ? { ok: false, reason: 'locked', minutesLeft: authLockoutMinutes }
      : { ok: false, reason: 'invalid' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })
  return { ok: true, user: { id: user.id, username: user.username, email: user.email } }
}

/** Rounded up, so "1 phút nữa" never means "any moment now, keep trying". */
export function remainingLockMinutes(lockedUntil: Date | null, now: number = Date.now()): number {
  if (!lockedUntil) return 0
  const remainingMs = lockedUntil.getTime() - now
  return remainingMs > 0 ? Math.ceil(remainingMs / 60_000) : 0
}
