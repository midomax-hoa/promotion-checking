/**
 * Turns the configuration form back into rule updates.
 *
 * Kept free of Prisma so the whole validation path - including "the operator
 * typed 500 into a percentage" - is testable without a database.
 *
 * Nothing submitted is trusted. The rule codes come from `RULE_CATALOG`, never
 * from the form, so a crafted request cannot create a row for a rule that does
 * not exist; severities and thresholds are validated before anything is written.
 */

import {
  RULE_CATALOG,
  findRuleDefinition,
  isGroupCode,
  type GroupCode,
  type RuleParams,
  type Severity,
} from '@/lib/rules/rule-catalog'
import { parseRuleParams, ruleParamFields } from './rule-config-schema'

const SEVERITIES: readonly Severity[] = ['critical', 'danger', 'warn']

/** Field names, defined once so the form and the action cannot disagree. */
export const ruleField = {
  enabled: (code: string) => `enabled:${code}`,
  severity: (code: string) => `severity:${code}`,
  param: (code: string, key: string) => `param:${code}:${key}`,
}

export type RuleIntent =
  | { kind: 'save' }
  | { kind: 'group'; groupCode: GroupCode; enabled: boolean }
  | { kind: 'reset'; code: string }
  | { kind: 'reset-all' }

/** Returns null for anything not in the grammar, including an unknown rule or group code. */
export function parseIntent(raw: string | null): RuleIntent | null {
  const value = raw ?? 'save'
  if (value === 'save') return { kind: 'save' }
  if (value === 'reset-all') return { kind: 'reset-all' }

  const [verb, argument = ''] = value.split(':')
  if (verb === 'reset') {
    return findRuleDefinition(argument) ? { kind: 'reset', code: argument } : null
  }
  if (verb === 'group-on' || verb === 'group-off') {
    if (!isGroupCode(argument)) return null
    return { kind: 'group', groupCode: argument, enabled: verb === 'group-on' }
  }
  return null
}

export type RuleUpdate = {
  code: string
  enabled: boolean
  severity: Severity
  params: RuleParams
}

export type RuleFormResult =
  | { ok: true; updates: RuleUpdate[] }
  | { ok: false; message: string; fieldErrors: Record<string, string> }

function readParams(formData: FormData, code: string): Record<string, string> {
  return Object.fromEntries(
    ruleParamFields(code).map((field) => [
      field.key,
      String(formData.get(ruleField.param(code, field.key)) ?? ''),
    ]),
  )
}

export function parseRuleForm(formData: FormData): RuleFormResult {
  const intent = parseIntent(formData.get('intent') as string | null)
  if (!intent) return { ok: false, message: 'Thao tác không hợp lệ.', fieldErrors: {} }

  const fieldErrors: Record<string, string> = {}
  const updates: RuleUpdate[] = []

  for (const definition of RULE_CATALOG) {
    const { code } = definition
    // A reset discards whatever the form holds for that rule, so its inputs are
    // not validated - otherwise a bad value would block the button meant to fix it.
    const resetting =
      intent.kind === 'reset-all' || (intent.kind === 'reset' && intent.code === code)

    let update: RuleUpdate
    if (resetting) {
      update = {
        code,
        enabled: definition.defaultEnabled,
        severity: definition.defaultSeverity,
        params: { ...definition.defaultParams },
      }
    } else {
      const severity = String(formData.get(ruleField.severity(code)) ?? '')
      if (!(SEVERITIES as readonly string[]).includes(severity)) {
        fieldErrors[ruleField.severity(code)] = 'Mức cảnh báo không hợp lệ.'
        continue
      }
      const params = parseRuleParams(code, readParams(formData, code))
      if (!params.ok) {
        for (const [key, message] of Object.entries(params.errors)) {
          fieldErrors[ruleField.param(code, key)] = message
        }
        continue
      }
      update = {
        code,
        enabled: formData.get(ruleField.enabled(code)) != null,
        severity: severity as Severity,
        params: params.params,
      }
    }

    if (intent.kind === 'group' && definition.groupCode === intent.groupCode) {
      update = { ...update, enabled: intent.enabled }
    }
    updates.push(update)
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: 'Có giá trị chưa hợp lệ nên chưa lưu được. Xem chi tiết ngay dưới ô nhập.',
      fieldErrors,
    }
  }
  return { ok: true, updates }
}

/** True when a stored row already holds exactly these values, so it need not be rewritten. */
export function sameRuleConfig(
  a: { enabled: boolean; severity: string; params: RuleParams },
  b: RuleUpdate,
): boolean {
  if (a.enabled !== b.enabled || a.severity !== b.severity) return false
  const keys = new Set([...Object.keys(a.params), ...Object.keys(b.params)])
  return [...keys].every((key) => a.params[key] === b.params[key])
}
