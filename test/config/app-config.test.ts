import { describe, expect, it } from 'vitest'
import { buildAppConfig } from '@/lib/config/app-config'
import { APP_SETTING_KEYS } from '@/lib/config/app-settings-catalog'

const withSettings = (overrides: Record<string, string>) =>
  buildAppConfig(new Map(Object.entries(overrides)))

describe('buildAppConfig', () => {
  it('falls back to seed defaults when the table is empty', () => {
    const config = withSettings({})
    expect(config.haravanPageSize).toBe(50)
    expect(config.haravanApiBase).toBe('https://apis.haravan.com')
    expect(config.moneyToleranceVnd).toBe(0.5)
  })

  it('uses operator values when they are valid', () => {
    const config = withSettings({ [APP_SETTING_KEYS.catalogMaxAgeHours]: '6' })
    expect(config.catalogMaxAgeHours).toBe(6)
  })

  it('rejects a blank value instead of turning it into 0', () => {
    // Number('') is 0 and finite, so a naive parse would stall the rate limiter.
    const config = withSettings({ [APP_SETTING_KEYS.haravanRequestsPerSecond]: '' })
    expect(config.haravanRequestsPerSecond).toBe(3)
  })

  it('rejects zero, negative and non-numeric values', () => {
    expect(withSettings({ [APP_SETTING_KEYS.haravanPageSize]: '0' }).haravanPageSize).toBe(50)
    expect(withSettings({ [APP_SETTING_KEYS.haravanPageSize]: '-5' }).haravanPageSize).toBe(50)
    expect(withSettings({ [APP_SETTING_KEYS.haravanPageSize]: 'abc' }).haravanPageSize).toBe(50)
  })

  it('refuses a page size above 50, which Haravan clamps anyway', () => {
    // A larger value would make a clamped 50-item page look like the last page,
    // stopping the sync early and letting the cleanup wipe the rest of the cache.
    expect(withSettings({ [APP_SETTING_KEYS.haravanPageSize]: '250' }).haravanPageSize).toBe(50)
    expect(withSettings({ [APP_SETTING_KEYS.haravanPageSize]: '20' }).haravanPageSize).toBe(20)
  })

  it('allows zero for tolerances and delays but not for counts', () => {
    expect(
      withSettings({ [APP_SETTING_KEYS.catalogCursorOverlapMs]: '0' }).catalogCursorOverlapMs,
    ).toBe(0)
    expect(
      withSettings({ [APP_SETTING_KEYS.catalogShortfallTolerance]: '0' }).catalogShortfallTolerance,
    ).toBe(0)
    expect(withSettings({ [APP_SETTING_KEYS.haravanMaxAttempts]: '0' }).haravanMaxAttempts).toBe(4)
  })

  it('keeps the promotion page size apart from the products one', () => {
    // Two endpoints, two server-side caps: products clamp at 50, promotions
    // honour 250. Sharing one setting would cost 36 extra requests per walk.
    expect(withSettings({}).haravanPromotionPageSize).toBe(250)
    expect(withSettings({}).haravanPageSize).toBe(50)
    // Above 250 the server answers with 50, so a larger value is refused rather
    // than passed through to be silently downgraded.
    expect(
      withSettings({ [APP_SETTING_KEYS.haravanPromotionPageSize]: '500' })
        .haravanPromotionPageSize,
    ).toBe(250)
  })

  it('paces the promotion walk by default and lets zero switch the rest off', () => {
    // Measured 2026-08-19: the promotions endpoint 429s below ~1100 ms spacing,
    // so the shipped default keeps a margin above that.
    expect(withSettings({}).haravanPromotionDelayMs).toBe(1200)
    expect(
      withSettings({ [APP_SETTING_KEYS.haravanPromotionDelayMs]: '0' }).haravanPromotionDelayMs,
    ).toBe(0)
    expect(
      withSettings({ [APP_SETTING_KEYS.haravanPromotionDelayMs]: '-1' }).haravanPromotionDelayMs,
    ).toBe(1200)
  })

  it('gives 429 retries their own, far larger budget than network retries', () => {
    const config = withSettings({})
    expect(config.haravanRateLimitMaxAttempts).toBe(30)
    expect(config.haravanRateLimitMaxAttempts).toBeGreaterThan(config.haravanMaxAttempts)
    // Zero patience would fail every throttled call on its first 429.
    expect(
      withSettings({ [APP_SETTING_KEYS.haravanRateLimitMaxAttempts]: '0' })
        .haravanRateLimitMaxAttempts,
    ).toBe(30)
  })

  it('reads the promotion fetch switch as a real boolean', () => {
    // Boolean('false') is true, so a coerced parse would switch the fetch back
    // on for every operator who had turned it off.
    expect(withSettings({}).checkFetchPromotions).toBe(true)
    expect(
      withSettings({ [APP_SETTING_KEYS.checkFetchPromotions]: 'true' }).checkFetchPromotions,
    ).toBe(true)
    expect(
      withSettings({ [APP_SETTING_KEYS.checkFetchPromotions]: 'false' }).checkFetchPromotions,
    ).toBe(false)
  })

  it('falls back to the seed default when the fetch switch holds nonsense', () => {
    for (const raw of ['', '1', 'yes', 'TRUE']) {
      expect(
        withSettings({ [APP_SETTING_KEYS.checkFetchPromotions]: raw }).checkFetchPromotions,
      ).toBe(true)
    }
  })

  it('refuses to point the Haravan base at a foreign host', () => {
    const cases = [
      'https://evil.example.com',
      'http://apis.haravan.com',
      'https://apis.haravan.com.evil.example.com',
      'not a url',
    ]
    for (const value of cases) {
      const config = withSettings({ [APP_SETTING_KEYS.haravanApiBase]: value })
      expect(config.haravanApiBase).toBe('https://apis.haravan.com')
    }
  })

  it('accepts another host inside haravan.com', () => {
    const config = withSettings({ [APP_SETTING_KEYS.haravanApiBase]: 'https://webhook.haravan.com' })
    expect(config.haravanApiBase).toBe('https://webhook.haravan.com')
  })

  it('ships the login settings with their seed defaults', () => {
    const config = withSettings({})
    expect(config.authSessionTtlHours).toBe(24)
    expect(config.authMaxFailedAttempts).toBe(5)
    expect(config.authLockoutMinutes).toBe(15)
    expect(config.authMinPasswordLength).toBe(8)
  })

  it('takes operator values for the login settings', () => {
    const config = withSettings({
      [APP_SETTING_KEYS.authSessionTtlHours]: '8',
      [APP_SETTING_KEYS.authMaxFailedAttempts]: '3',
    })
    expect(config.authSessionTtlHours).toBe(8)
    expect(config.authMaxFailedAttempts).toBe(3)
  })

  it('will not let a bad login setting weaken the lock or the session', () => {
    // 0 attempts would lock every account on its first try; a 0 hour session
    // would expire the moment it is created; a 1 character minimum is no
    // minimum at all. All three fall back to the default instead.
    expect(withSettings({ [APP_SETTING_KEYS.authMaxFailedAttempts]: '0' }).authMaxFailedAttempts).toBe(5)
    expect(withSettings({ [APP_SETTING_KEYS.authSessionTtlHours]: '0' }).authSessionTtlHours).toBe(24)
    expect(withSettings({ [APP_SETTING_KEYS.authSessionTtlHours]: '' }).authSessionTtlHours).toBe(24)
    expect(withSettings({ [APP_SETTING_KEYS.authMinPasswordLength]: '1' }).authMinPasswordLength).toBe(8)
    expect(withSettings({ [APP_SETTING_KEYS.authLockoutMinutes]: '-5' }).authLockoutMinutes).toBe(15)
  })
})
