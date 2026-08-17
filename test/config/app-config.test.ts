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
})
