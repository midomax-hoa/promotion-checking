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
  authSessionTtlHours: 'auth.session_ttl_hours',
  authMaxFailedAttempts: 'auth.max_failed_attempts',
  authLockoutMinutes: 'auth.lockout_minutes',
  authMinPasswordLength: 'auth.min_password_length',
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
    description:
      'Danh sách sản phẩm tải về từ Haravan cũ hơn số giờ này thì màn hình kiểm tra sẽ nhắc đồng bộ lại',
  },
  {
    key: APP_SETTING_KEYS.haravanApiBase,
    value: 'https://apis.haravan.com',
    description: 'Địa chỉ máy chủ Haravan mà công cụ gọi tới, chỉ đổi khi Haravan đổi địa chỉ',
  },
  {
    key: APP_SETTING_KEYS.haravanPageSize,
    value: '50',
    description: 'Mỗi lượt lấy về bao nhiêu sản phẩm khi đồng bộ - Haravan chỉ cho tối đa 50',
  },
  {
    key: APP_SETTING_KEYS.haravanRequestsPerSecond,
    value: '3',
    description:
      'Mỗi giây gọi Haravan tối đa bao nhiêu lượt. Haravan cho 4, để 3 cho chắc - đặt cao hơn dễ bị chặn tạm thời',
  },
  {
    key: APP_SETTING_KEYS.haravanMaxAttempts,
    value: '4',
    description: 'Gọi Haravan bị lỗi thì thử lại tối đa mấy lần trước khi báo thất bại',
  },
  {
    key: APP_SETTING_KEYS.catalogCursorOverlapMs,
    value: '300000',
    description:
      'Khi đồng bộ nhanh (chỉ lấy phần vừa thay đổi), lùi mốc thời gian lại chừng này mili giây '
      + 'để không bỏ sót sản phẩm được sửa ngay lúc đang đồng bộ. 300000 là 5 phút',
  },
  {
    key: APP_SETTING_KEYS.catalogShortfallTolerance,
    value: '0',
    description:
      'Được phép thiếu bao nhiêu sản phẩm so với tổng số Haravan báo mà vẫn coi là đồng bộ đủ. '
      + 'Để 0 nghĩa là phải khớp đúng từng sản phẩm',
  },
  {
    key: APP_SETTING_KEYS.reconcileRecheckDelayMs,
    value: '8000',
    description:
      'Khi đối soát, chờ chừng này mili giây rồi kiểm lại lần hai. Haravan cần chút thời gian mới '
      + 'hiện chương trình vừa tạo, chờ như vậy để khỏi báo lỗi oan. 8000 là 8 giây',
  },
  {
    key: APP_SETTING_KEYS.shopTimezoneOffsetMinutes,
    value: '420',
    description:
      'Múi giờ cửa hàng, ghi bằng số phút lệch so với giờ quốc tế. Việt Nam là 420, tức GMT+7. '
      + 'Haravan trả về giờ quốc tế nên phải quy đổi trước khi so ngày',
  },
  {
    key: APP_SETTING_KEYS.reportMaxRowsPerPage,
    value: '100',
    description: 'Số dòng mỗi trang của bảng kết quả',
  },
  {
    key: APP_SETTING_KEYS.moneyToleranceVnd,
    value: '0.5',
    description:
      'So tiền mà lệch dưới mức này (tính bằng đồng) thì coi như bằng nhau. Chỉ để bỏ qua sai số lẻ '
      + 'lúc máy tính toán, không phải để bỏ qua lệch giá thật',
  },
  {
    key: APP_SETTING_KEYS.checkFetchPromotions,
    value: 'true',
    description:
      'Gõ true để bật, false để tắt. Bật thì mỗi lần kiểm tra file sẽ tải danh sách chương trình '
      + 'đang có trên Haravan về để chạy luật D8 và E3. Tắt thì hai luật đó ghi là bỏ qua, đổi lại '
      + 'kiểm tra nhanh hơn vì khỏi chờ mạng',
  },
  {
    key: APP_SETTING_KEYS.haravanPromotionPageSize,
    value: '250',
    description:
      'Mỗi lượt lấy về bao nhiêu chương trình. Danh sách chương trình cho tối đa 250, khác danh sách '
      + 'sản phẩm chỉ được 50. Đặt quá 250 thì Haravan âm thầm trả về 50',
  },
  {
    key: APP_SETTING_KEYS.haravanPromotionMaxPages,
    value: '200',
    description:
      'Lấy nhiều nhất chừng này lượt khi tải danh sách chương trình, để công cụ không chạy hoài nếu '
      + 'Haravan trả dữ liệu bất thường. Chạm mức này thì báo lỗi chứ không đưa ra danh sách thiếu',
  },
  {
    key: APP_SETTING_KEYS.authSessionTtlHours,
    value: '24',
    description:
      'Đăng nhập một lần thì dùng được bao nhiêu giờ rồi phải đăng nhập lại. Để 24 là mỗi ngày '
      + 'đăng nhập một lần. Rút ngắn thì an toàn hơn nhưng phải gõ mật khẩu thường xuyên hơn',
  },
  {
    key: APP_SETTING_KEYS.authMaxFailedAttempts,
    value: '5',
    description:
      'Gõ sai mật khẩu liên tiếp bao nhiêu lần thì khoá tài khoản tạm thời, để người lạ không dò '
      + 'mật khẩu bằng cách thử hoài. Đăng nhập đúng một lần là đếm lại từ đầu',
  },
  {
    key: APP_SETTING_KEYS.authLockoutMinutes,
    value: '15',
    description:
      'Bị khoá tạm thì phải chờ bao nhiêu phút mới đăng nhập lại được. Hết thời gian này tài khoản '
      + 'tự mở lại, không cần ai can thiệp',
  },
  {
    key: APP_SETTING_KEYS.authMinPasswordLength,
    value: '8',
    description:
      'Mật khẩu phải dài ít nhất bao nhiêu ký tự khi tạo tài khoản hoặc đổi mật khẩu. Chỉ áp dụng '
      + 'lúc đặt mật khẩu mới, không ảnh hưởng tài khoản đã có',
  },
]

export function defaultSettingValue(key: string): string | undefined {
  return DEFAULT_APP_SETTINGS.find((s) => s.key === key)?.value
}
