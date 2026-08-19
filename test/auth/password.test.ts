import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('hashPassword / verifyPassword', () => {
  it('accepts the password it was built from', async () => {
    const stored = await hashPassword('mat-khau-that')
    expect(await verifyPassword('mat-khau-that', stored)).toBe(true)
  })

  it('rejects a wrong password, including one that only differs in case', async () => {
    const stored = await hashPassword('mat-khau-that')
    expect(await verifyPassword('mat-khau-sai', stored)).toBe(false)
    expect(await verifyPassword('Mat-Khau-That', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
  })

  it('salts every hash, so two identical passwords never store the same string', async () => {
    const [first, second] = await Promise.all([hashPassword('trung-nhau'), hashPassword('trung-nhau')])
    expect(first).not.toBe(second)
    expect(await verifyPassword('trung-nhau', second)).toBe(true)
  })

  it('records its parameters so a stored hash stays self-describing', async () => {
    const parts = (await hashPassword('bat-ky')).split('$')
    expect(parts).toHaveLength(6)
    expect(parts[0]).toBe('scrypt')
    expect(Number(parts[1])).toBeGreaterThan(0)
  })

  it('treats the two Unicode spellings of a Vietnamese password as one', async () => {
    // Composed "ế" (U+1EBF) versus the same letter decomposed - a Vietnamese IME
    // can produce either, and both have to open the same account.
    const composed = 'tiếng-việt'
    const decomposed = composed.normalize('NFD')
    expect(composed).not.toBe(decomposed)
    expect(await verifyPassword(decomposed, await hashPassword(composed))).toBe(true)
  })

  it('answers false rather than throwing on a stored value it cannot parse', async () => {
    // A corrupted row means "does not match", never a 500 that confirms the
    // account exists.
    for (const broken of ['', 'khong-phai-hash', 'scrypt$16384$8$1$only-five-parts', 'scrypt$0$8$1$c2E=$aGE=']) {
      expect(await verifyPassword('bat-ky', broken)).toBe(false)
    }
  })

  it('rejects a hash whose stored digest has been swapped for a shorter one', async () => {
    const stored = await hashPassword('mat-khau-that')
    const parts = stored.split('$')
    parts[5] = Buffer.from('ngan').toString('base64')
    expect(await verifyPassword('mat-khau-that', parts.join('$'))).toBe(false)
  })
})
