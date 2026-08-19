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
/**
 * Booleans are stored as text like every other setting, so only these two words
 * are accepted. Refined rather than coerced: `Boolean('false')` is `true`, which
 * would turn a switched-off setting into a switched-on one.
 */
const booleanText = z
  .string()
  .refine((value) => value === 'true' || value === 'false', 'Chỉ nhận true hoặc false.')
  .transform((value) => value === 'true')

/** A timezone offset is a signed number of minutes; UTC-12:00 to UTC+14:00 covers every real zone. */
const timezoneOffsetMinutes = z.coerce.number().int().min(-720).max(840)

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
  shopTimezoneOffsetMinutes: [
    APP_SETTING_KEYS.shopTimezoneOffsetMinutes,
    timezoneOffsetMinutes,
  ],
  reportMaxRowsPerPage: [APP_SETTING_KEYS.reportMaxRowsPerPage, positiveInt.max(1000)],
  moneyToleranceVnd: [APP_SETTING_KEYS.moneyToleranceVnd, positiveNumber.max(1000)],
  checkFetchPromotions: [APP_SETTING_KEYS.checkFetchPromotions, booleanText],
  // Measured on the real shop 2026-08-19: `/com/promotions.json` honours limit
  // up to 250 and silently falls back to 50 above it, unlike the products
  // endpoint which clamps at 50. The two cannot share one setting.
  haravanPromotionPageSize: [APP_SETTING_KEYS.haravanPromotionPageSize, positiveInt.max(250)],
  haravanPromotionMaxPages: [APP_SETTING_KEYS.haravanPromotionMaxPages, positiveInt.max(10_000)],
  // A year is already far past "convenient"; anything longer is an unattended
  // session nobody remembers opening.
  authSessionTtlHours: [APP_SETTING_KEYS.authSessionTtlHours, positiveInt.max(24 * 365)],
  authMaxFailedAttempts: [APP_SETTING_KEYS.authMaxFailedAttempts, positiveInt.max(100)],
  // Capped at a day: a longer lockout is indistinguishable from a lost account.
  authLockoutMinutes: [APP_SETTING_KEYS.authLockoutMinutes, positiveInt.max(1440)],
  // Floor of 6 so the setting itself cannot be turned into a way to allow a
  // one-character password; 128 is well past any password a person will type.
  authMinPasswordLength: [APP_SETTING_KEYS.authMinPasswordLength, positiveInt.min(6).max(128)],
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

/**
 * Same schemas, keyed by the stored setting key, so the configuration screen
 * rejects a value with exactly the rule the runtime would apply to it. Anything
 * validated here is guaranteed never to hit the fallback in `resolveField`.
 */
const SCHEMA_BY_KEY: ReadonlyMap<string, z.ZodType> = new Map(
  Object.values(APP_CONFIG_SCHEMA).map(([key, schema]) => [key, schema as z.ZodType]),
)

/** Zod speaks English; the screen is Vietnamese, and the operator needs the bound spelled out. */
function vietnameseIssue(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.expected === 'int' ? 'Phải là số nguyên.' : 'Phải là một con số.'
    case 'too_big':
      return `Giá trị tối đa cho phép là ${issue.maximum}.`
    case 'too_small':
      return issue.inclusive
        ? `Giá trị tối thiểu cho phép là ${issue.minimum}.`
        : `Phải lớn hơn ${issue.minimum}.`
    default:
      // Custom refinements already carry a Vietnamese message.
      return issue.message
  }
}

export type SettingValidation = { ok: true } | { ok: false; message: string }

export function validateSettingValue(key: string, raw: string): SettingValidation {
  const schema = SCHEMA_BY_KEY.get(key)
  if (!schema) return { ok: false, message: 'Thiết lập này không có trong danh mục cấu hình.' }
  if (raw.trim() === '') return { ok: false, message: 'Không được để trống.' }

  const parsed = schema.safeParse(raw)
  if (parsed.success) return { ok: true }
  const issue = parsed.error.issues[0]
  return { ok: false, message: issue ? vietnameseIssue(issue) : 'Giá trị không hợp lệ.' }
}

/** Setting keys the configuration screen may write, i.e. the ones the app actually reads. */
export const EDITABLE_SETTING_KEYS: readonly string[] = [...SCHEMA_BY_KEY.keys()]
