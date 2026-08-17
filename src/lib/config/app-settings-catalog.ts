/**
 * Default values for the AppSetting table.
 * Nothing business related is hard-coded elsewhere: these are seed defaults only,
 * every value stays editable from the configuration screen (phase 07).
 */

export type AppSettingDefinition = {
  key: string
  value: string
  description: string
}

export const APP_SETTING_KEYS = {
  catalogMaxAgeHours: 'catalog.max_age_hours',
  haravanApiBase: 'haravan.api_base',
  haravanPageSize: 'haravan.page_size',
  haravanRequestsPerSecond: 'haravan.requests_per_second',
  reconcileRecheckDelayMs: 'reconcile.recheck_delay_ms',
  reportMaxRowsPerPage: 'report.max_rows_per_page',
  moneyToleranceVnd: 'check.money_tolerance_vnd',
} as const

/**
 * Hosts the Haravan API base is allowed to point at.
 * The private app token is attached to every request against that base, so an
 * operator editing this setting must not be able to redirect it elsewhere.
 */
export const HARAVAN_ALLOWED_HOST_SUFFIXES = ['.haravan.com'] as const

export const DEFAULT_APP_SETTINGS: readonly AppSettingDefinition[] = [
  {
    key: APP_SETTING_KEYS.catalogMaxAgeHours,
    value: '24',
    description: 'Cache danh mục cũ hơn số giờ này thì cảnh báo',
  },
  {
    key: APP_SETTING_KEYS.haravanApiBase,
    value: 'https://apis.haravan.com',
    description: 'Địa chỉ gốc của API Haravan',
  },
  {
    key: APP_SETTING_KEYS.haravanPageSize,
    value: '50',
    description: 'Số bản ghi mỗi trang - Haravan ép cứng 50',
  },
  {
    key: APP_SETTING_KEYS.haravanRequestsPerSecond,
    value: '3',
    description: 'Số lượt gọi mỗi giây, đặt dưới mức rỉ 4/s cho an toàn',
  },
  {
    key: APP_SETTING_KEYS.reconcileRecheckDelayMs,
    value: '8000',
    description: 'Khoảng chờ giữa hai lần kiểm để tránh báo oan do trễ chỉ mục',
  },
  {
    key: APP_SETTING_KEYS.reportMaxRowsPerPage,
    value: '100',
    description: 'Số dòng mỗi trang của bảng kết quả',
  },
  {
    key: APP_SETTING_KEYS.moneyToleranceVnd,
    value: '0.5',
    description: 'Ngưỡng sai số khi so sánh tiền, tránh lệch do dấu phẩy động',
  },
]

export function defaultSettingValue(key: string): string | undefined {
  return DEFAULT_APP_SETTINGS.find((s) => s.key === key)?.value
}
