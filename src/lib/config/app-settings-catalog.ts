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
  haravanMaxAttempts: 'haravan.max_attempts',
  catalogCursorOverlapMs: 'catalog.cursor_overlap_ms',
  catalogShortfallTolerance: 'catalog.sync_shortfall_tolerance',
  reconcileRecheckDelayMs: 'reconcile.recheck_delay_ms',
  shopTimezoneOffsetMinutes: 'shop.timezone_offset_minutes',
  reportMaxRowsPerPage: 'report.max_rows_per_page',
  moneyToleranceVnd: 'check.money_tolerance_vnd',
  checkFetchPromotions: 'check.fetch_promotions',
  haravanPromotionPageSize: 'haravan.promotion_page_size',
  haravanPromotionMaxPages: 'haravan.promotion_max_pages',
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
    key: APP_SETTING_KEYS.haravanMaxAttempts,
    value: '4',
    description: 'Số lần thử tối đa cho một lượt gọi API trước khi coi là thất bại',
  },
  {
    key: APP_SETTING_KEYS.catalogCursorOverlapMs,
    value: '300000',
    description:
      'Lùi mốc đồng bộ tăng dần lại chừng này mili giây, tránh bỏ sót sản phẩm sửa ngay lúc đang đồng bộ',
  },
  {
    key: APP_SETTING_KEYS.catalogShortfallTolerance,
    value: '0',
    description:
      'Số sản phẩm được phép thiếu so với products/count.json mà vẫn coi là đồng bộ đầy đủ',
  },
  {
    key: APP_SETTING_KEYS.reconcileRecheckDelayMs,
    value: '8000',
    description: 'Khoảng chờ giữa hai lần kiểm để tránh báo oan do trễ chỉ mục',
  },
  {
    key: APP_SETTING_KEYS.shopTimezoneOffsetMinutes,
    value: '420',
    description:
      'Lệch múi giờ của cửa hàng so với UTC, tính bằng phút - Haravan trả mốc thời gian dạng UTC nên phải quy đổi trước khi so',
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
  {
    key: APP_SETTING_KEYS.checkFetchPromotions,
    value: 'true',
    description:
      'true/false - kéo danh sách chương trình từ Haravan khi kiểm tra file, để chạy luật D8 và E3. '
      + 'Tắt đi thì hai luật đó được ghi là bỏ qua, đổi lại mỗi lượt kiểm tra không phải chờ mạng',
  },
  {
    key: APP_SETTING_KEYS.haravanPromotionPageSize,
    value: '250',
    description:
      'Số chương trình mỗi trang - endpoint chương trình nhận tới 250, khác endpoint sản phẩm bị ép 50. '
      + 'Đặt quá 250 thì máy chủ lặng lẽ trả về 50',
  },
  {
    key: APP_SETTING_KEYS.haravanPromotionMaxPages,
    value: '200',
    description:
      'Trần số trang khi duyệt danh sách chương trình, chặn vòng lặp vô hạn nếu phân trang trục trặc. '
      + 'Chạm trần thì lượt kéo báo lỗi thay vì trả về danh sách thiếu',
  },
]

export function defaultSettingValue(key: string): string | undefined {
  return DEFAULT_APP_SETTINGS.find((s) => s.key === key)?.value
}
