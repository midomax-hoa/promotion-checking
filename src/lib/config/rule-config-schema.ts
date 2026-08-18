/**
 * Editable thresholds of the rules that have any, described once.
 *
 * A field descriptor carries both the bounds and the Vietnamese wording, so the
 * validation message and the input hint can never drift apart, and the
 * configuration screen builds its inputs from the same list the Server Action
 * validates against. A rule whose params are not described here simply has no
 * editable threshold - it is not an error.
 *
 * Bounds are guard rails, not business decisions: the meaningful value is the
 * default in `rule-catalog.ts`, and everything inside the range stays the
 * operator's call.
 */

import { z } from 'zod'
import type { RuleParams } from '@/lib/rules/rule-catalog'

export type RuleParamField = {
  key: string
  label: string
  unit?: string
  min: number
  max: number
  /** false = fractions are meaningful, e.g. a tolerance. */
  integer: boolean
  hint?: string
}

const RULE_PARAM_FIELDS: Readonly<Record<string, readonly RuleParamField[]>> = {
  B1: [
    {
      key: 'suggestMaxDistance',
      label: 'Độ lệch tối đa khi gợi ý SKU gần giống',
      unit: 'ký tự',
      min: 1,
      max: 5,
      integer: true,
      hint: 'Càng lớn càng gợi ý được nhiều nhưng dễ gợi ý sai và chạy chậm hơn',
    },
    {
      key: 'suggestMaxComparisons',
      label: 'Số phép so tối đa khi tìm gợi ý',
      unit: 'phép so',
      min: 10_000,
      max: 20_000_000,
      integer: true,
      hint: 'Chặn trên để file toàn SKU lạ không làm lần kiểm tra kéo dài hàng phút',
    },
  ],
  C4: [
    {
      key: 'maxDiscountPercent',
      label: 'Mức giảm tối đa coi là bình thường',
      unit: '%',
      min: 1,
      max: 100,
      integer: false,
    },
  ],
  C5: [
    {
      key: 'maxPercentValue',
      label: 'Giá trị lớn nhất chấp nhận ở cột phần trăm',
      min: 0.01,
      max: 100,
      integer: false,
      hint: 'Trong file, phần trăm luôn ghi dạng thập phân: 0.5 nghĩa là 50%',
    },
  ],
  C7: [
    {
      key: 'roundingUnit',
      label: 'Đơn vị làm tròn của giá sau giảm',
      unit: 'đ',
      min: 1,
      max: 1_000_000,
      integer: true,
    },
  ],
  D7: [
    {
      key: 'maxDurationDays',
      label: 'Thời lượng tối đa của một chương trình',
      unit: 'ngày',
      min: 1,
      max: 3_650,
      integer: true,
    },
    {
      key: 'minDurationDays',
      label: 'Thời lượng tối thiểu của một chương trình',
      unit: 'ngày',
      min: 1,
      max: 3_650,
      integer: true,
    },
  ],
  F2: [
    {
      key: 'percentTolerance',
      label: 'Sai số cho phép khi so phần trăm',
      unit: '%',
      min: 0,
      max: 100,
      integer: false,
      hint: 'Chỉ để hấp thụ sai lệch dấu phẩy động, không phải để bỏ qua lệch thật',
    },
  ],
}

const NUMBER = new Intl.NumberFormat('vi-VN')

function rangeMessage(field: RuleParamField): string {
  const unit = field.unit ? ` ${field.unit}` : ''
  return `${field.label} phải nằm trong khoảng ${NUMBER.format(field.min)} đến ${NUMBER.format(field.max)}${unit}.`
}

function fieldSchema(field: RuleParamField) {
  const base = z.coerce.number({ error: `${field.label} phải là một con số.` })
  const message = rangeMessage(field)
  return (field.integer ? base.int({ error: `${field.label} phải là số nguyên.` }) : base)
    .min(field.min, { error: message })
    .max(field.max, { error: message })
}

/** Zod schema per rule, as the phase plan specifies. Built from the field list so the two cannot diverge. */
export const ruleParamSchemas: Readonly<Record<string, z.ZodType<RuleParams>>> = Object.fromEntries(
  Object.entries(RULE_PARAM_FIELDS).map(([code, fields]) => [
    code,
    z.object(Object.fromEntries(fields.map((f) => [f.key, fieldSchema(f)]))) as z.ZodType<RuleParams>,
  ]),
)

export function ruleParamFields(code: string): readonly RuleParamField[] {
  return RULE_PARAM_FIELDS[code] ?? []
}

export type ParamParseResult =
  | { ok: true; params: RuleParams }
  | { ok: false; errors: Record<string, string> }

/**
 * Validates the raw strings a form produced for one rule.
 * Errors are keyed by param key so the screen can mark the offending input.
 */
export function parseRuleParams(code: string, raw: Record<string, string>): ParamParseResult {
  const fields = ruleParamFields(code)
  if (fields.length === 0) return { ok: true, params: {} }

  const errors: Record<string, string> = {}
  const params: RuleParams = {}
  for (const field of fields) {
    const value = (raw[field.key] ?? '').trim()
    if (value === '') {
      errors[field.key] = `${field.label} không được để trống.`
      continue
    }
    const parsed = fieldSchema(field).safeParse(value)
    if (parsed.success) params[field.key] = parsed.data
    else errors[field.key] = parsed.error.issues[0]?.message ?? rangeMessage(field)
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, params }
}
