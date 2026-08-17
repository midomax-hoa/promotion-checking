import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import {
  APP_SETTING_KEYS,
  HARAVAN_ALLOWED_HOST_SUFFIXES,
  defaultSettingValue,
} from './app-settings-catalog'

/**
 * Reads AppSetting rows into a validated, typed config object.
 *
 * Every value is operator-editable from the configuration screen (phase 07), so
 * nothing here may be trusted: a blank or nonsensical value falls back to the
 * seed default instead of propagating a 0 into a rate limiter or a paginator.
 */

const positiveInt = z.coerce.number().int().positive()
const positiveNumber = z.coerce.number().positive()
/** Zero is a meaningful setting for tolerances and delays, unlike for a page size. */
const nonNegativeInt = z.coerce.number().int().nonnegative()

/** Must stay on Haravan, otherwise the API token would be sent to a foreign host. */
const haravanBaseUrl = z.string().refine((value) => {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      HARAVAN_ALLOWED_HOST_SUFFIXES.some(
        (suffix) => url.hostname === suffix.slice(1) || url.hostname.endsWith(suffix),
      )
    )
  } catch {
    return false
  }
}, 'Địa chỉ API Haravan phải dùng https và thuộc tên miền haravan.com')

const APP_CONFIG_SCHEMA = {
  catalogMaxAgeHours: [APP_SETTING_KEYS.catalogMaxAgeHours, positiveInt.max(24 * 365)],
  haravanApiBase: [APP_SETTING_KEYS.haravanApiBase, haravanBaseUrl],
  // Haravan clamps `limit` to 50 server-side (verified 2026-08-17). A larger
  // value here would make the paginator think a full page is a short one.
  haravanPageSize: [APP_SETTING_KEYS.haravanPageSize, positiveInt.max(50)],
  haravanRequestsPerSecond: [APP_SETTING_KEYS.haravanRequestsPerSecond, positiveNumber.max(4)],
  haravanMaxAttempts: [APP_SETTING_KEYS.haravanMaxAttempts, positiveInt.max(10)],
  catalogCursorOverlapMs: [APP_SETTING_KEYS.catalogCursorOverlapMs, nonNegativeInt.max(86_400_000)],
  catalogShortfallTolerance: [APP_SETTING_KEYS.catalogShortfallTolerance, nonNegativeInt.max(10_000)],
  reconcileRecheckDelayMs: [APP_SETTING_KEYS.reconcileRecheckDelayMs, positiveInt.max(120_000)],
  reportMaxRowsPerPage: [APP_SETTING_KEYS.reportMaxRowsPerPage, positiveInt.max(1000)],
  moneyToleranceVnd: [APP_SETTING_KEYS.moneyToleranceVnd, positiveNumber.max(1000)],
} as const

type ConfigField = keyof typeof APP_CONFIG_SCHEMA
type AppConfigShape = {
  [K in ConfigField]: z.infer<(typeof APP_CONFIG_SCHEMA)[K][1]>
}

/**
 * Resolves one field from a raw value, falling back to the seed default and then
 * throwing only if the default itself is invalid (a programming error).
 */
function resolveField<K extends ConfigField>(field: K, raw: string | undefined): AppConfigShape[K] {
  const [key, schema] = APP_CONFIG_SCHEMA[field]
  const parsed = schema.safeParse(raw)
  if (parsed.success) return parsed.data as AppConfigShape[K]

  const fallback = schema.safeParse(defaultSettingValue(key))
  if (fallback.success) return fallback.data as AppConfigShape[K]

  throw new Error(`Giá trị mặc định của cấu hình "${key}" không hợp lệ.`)
}

export function buildAppConfig(rawValues: Map<string, string>): AppConfigShape {
  const entries = (Object.keys(APP_CONFIG_SCHEMA) as ConfigField[]).map((field) => {
    const [key] = APP_CONFIG_SCHEMA[field]
    return [field, resolveField(field, rawValues.get(key))]
  })
  return Object.fromEntries(entries) as AppConfigShape
}

/** Reads every setting the app needs in one round trip. */
export async function getAppConfig(): Promise<AppConfigShape> {
  const rows = await prisma.appSetting.findMany()
  return buildAppConfig(new Map(rows.map((row) => [row.key, row.value])))
}

export type AppConfig = AppConfigShape
