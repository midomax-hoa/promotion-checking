/**
 * Single source of truth for the 37 checking rules (groups A-F).
 * Used by prisma/seed.ts to populate RuleConfig and by the rule engine (phase 04)
 * to cross-check that every declared rule is actually implemented.
 *
 * Severity meaning, derived from verified Haravan behaviour:
 *   critical - Haravan answers 422, the promotion is not created at all
 *   danger   - Haravan accepts it, but the business result is wrong or costs money
 *   warn     - may well be intentional, just worth a second look
 */

export type Severity = 'critical' | 'danger' | 'warn'
export type GroupCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

/** Rule thresholds are stored as JSON in RuleConfig.params, so only JSON scalars are allowed. */
export type RuleParams = Record<string, number | string | boolean>

export type RuleDefinition = {
  code: string
  groupCode: GroupCode
  title: string
  defaultSeverity: Severity
  defaultEnabled: boolean
  defaultParams?: RuleParams
}

const rule = (
  code: string,
  groupCode: GroupCode,
  title: string,
  defaultSeverity: Severity,
  extra: { enabled?: boolean; params?: RuleParams } = {},
): RuleDefinition => ({
  code,
  groupCode,
  title,
  defaultSeverity,
  defaultEnabled: extra.enabled ?? true,
  defaultParams: extra.params,
})

export const RULE_CATALOG: readonly RuleDefinition[] = [
  // Group A - file structure
  rule('A1', 'A', 'Thiếu cột bắt buộc (Mã hiệu, Kiểu ctkm, Tên ctkm)', 'critical'),
  rule('A2', 'A', 'Liệt kê mọi sheet kèm số dòng đã đọc', 'warn'),
  rule('A3', 'A', 'Ô ngày sai định dạng hoặc không đọc được', 'danger'),
  rule('A4', 'A', 'Ô SKU rỗng hoặc chỉ có khoảng trắng', 'warn'),
  rule('A5', 'A', 'Dòng trống xen giữa vùng dữ liệu', 'warn'),

  // Group B - checked against the Haravan catalog cache
  // `suggestMaxComparisons` bounds the near-match search across a whole run.
  // Without it, a file whose SKUs are all absent from the catalog spends
  // minutes guessing at codes nobody can use - see helpers/levenshtein.ts.
  rule('B1', 'B', 'SKU không tồn tại trên Haravan', 'danger', {
    params: { suggestMaxDistance: 2, suggestMaxComparisons: 2_000_000 },
  }),
  rule('B2', 'B', 'Sản phẩm chưa đăng bán hoặc đang ẩn', 'warn'),
  rule('B3', 'B', 'Giá niêm yết trong file lệch giá thật trên Haravan', 'danger'),
  rule('B4', 'B', 'Mã hiệu không bắt đầu bằng Mã', 'warn'),
  rule('B5', 'B', 'SKU khớp nhiều biến thể trên Haravan', 'danger'),
  rule('B6', 'B', 'Sản phẩm bị đánh dấu cấm khuyến mãi', 'danger'),

  // Group C - arithmetic
  rule('C1', 'C', 'Giá niêm yết trừ Số tiền giảm khác Giá sau giảm', 'danger'),
  rule('C2', 'C', 'Số tiền giảm bằng 0 hoặc âm', 'critical'),
  rule('C3', 'C', 'Số tiền giảm lớn hơn hoặc bằng giá niêm yết', 'danger'),
  rule('C4', 'C', 'Giảm sâu quá ngưỡng cho phép', 'warn', { params: { maxDiscountPercent: 70 } }),
  // In the Excel file a percentage is always a decimal fraction, so anything above
  // maxPercentValue means the operator typed 50 where 0.5 was expected.
  rule('C5', 'C', 'Cột phần trăm ghi dạng 50 thay vì 0.5', 'critical', {
    params: { maxPercentValue: 1 },
  }),
  rule('C6', 'C', 'Kiểu ctkm không xác định hoặc điền lệch cột', 'critical'),
  rule('C7', 'C', 'Giá sau giảm không tròn đơn vị làm tròn', 'warn', { params: { roundingUnit: 1000 } }),

  // Group D - per promotion program
  rule('D1', 'D', 'Tên chương trình không khớp giá trị giảm', 'warn', { enabled: false }),
  rule('D2', 'D', 'Tên chương trình ghi tháng khác với ngày trong dòng', 'warn', { enabled: false }),
  rule('D3', 'D', 'Cùng tên chương trình nhưng các dòng ghi ngày hoặc mức giảm khác nhau', 'danger'),
  rule('D4', 'D', 'Ngày bắt đầu đã trôi qua', 'warn'),
  rule('D5', 'D', 'Ngày kết thúc đã qua', 'danger'),
  rule('D6', 'D', 'Ngày kết thúc trước ngày bắt đầu', 'critical'),
  rule('D7', 'D', 'Thời lượng chương trình bất thường', 'warn', {
    params: { maxDurationDays: 90, minDurationDays: 1 },
  }),
  rule('D8', 'D', 'Tên chương trình đã tồn tại trên Haravan', 'danger'),
  rule('D9', 'D', 'Số dư âm, hoặc bằng 0 mà không để trống', 'warn'),
  rule('D10', 'D', 'Trong cùng chương trình các dòng ghi Số dư khác nhau', 'danger'),

  // Group E - overlap
  rule('E1', 'E', 'Một SKU nằm trong từ 2 chương trình có thời gian giao nhau', 'danger'),
  rule('E2', 'E', 'SKU trùng lặp trong cùng một chương trình', 'critical'),
  rule('E3', 'E', 'SKU đang thuộc chương trình khác đang chạy trên Haravan', 'warn'),

  // Group F - reconciliation after import
  rule('F1', 'F', 'Dòng có trong Excel nhưng không tìm thấy trên Haravan', 'critical'),
  // Percentages are whole numbers on both sides once converted, so the tolerance
  // only absorbs floating-point noise. Money uses `check.money_tolerance_vnd`.
  rule('F2', 'F', 'Giá trị giảm trên Haravan lệch với Excel', 'critical', {
    params: { percentTolerance: 0.01 },
  }),
  rule('F3', 'F', 'Ngày bắt đầu hoặc kết thúc lệch', 'critical'),
  rule('F4', 'F', 'Chương trình đã tạo nhưng đang ở trạng thái tắt', 'warn'),
  rule('F5', 'F', 'Số SKU đính kèm lệch giữa Excel và Haravan', 'critical'),
  rule('F6', 'F', 'Haravan có chương trình mà Excel không có', 'warn'),
]

/**
 * System-level finding codes. These are deliberately NOT rows in RuleConfig:
 * they report missing input data rather than a business rule, so they must never
 * be switched off or downgraded from the configuration screen. The result screen
 * resolves their label from this map instead of joining against RuleConfig.
 */
export const SYSTEM_RULE_CATALOG_EMPTY = 'SYS-CATALOG-EMPTY'
/** Two promotions on Haravan share a name, so no rule may conclude which one is meant. */
export const SYSTEM_RECONCILE_AMBIGUOUS = 'SYS-RECONCILE-AMBIGUOUS'
/** The two reconciliation passes disagreed, so the result is not yet trustworthy. */
export const SYSTEM_RECONCILE_DISAGREED = 'SYS-RECONCILE-DISAGREED'

export const SYSTEM_FINDING_TITLES: Readonly<Record<string, string>> = {
  [SYSTEM_RULE_CATALOG_EMPTY]: 'Chưa đồng bộ danh mục sản phẩm nên bỏ qua toàn bộ nhóm luật B',
  [SYSTEM_RECONCILE_AMBIGUOUS]: 'Haravan có nhiều chương trình trùng tên nên không tự đối chiếu được',
  [SYSTEM_RECONCILE_DISAGREED]: 'Hai lượt đối soát cho kết quả khác nhau, nên chạy lại',
}

export const RULE_CODES: readonly string[] = RULE_CATALOG.map((r) => r.code)

export function findRuleDefinition(code: string): RuleDefinition | undefined {
  return RULE_CATALOG.find((r) => r.code === code)
}
