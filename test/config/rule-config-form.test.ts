import { describe, expect, it } from 'vitest'
import { validateSettingValue } from '@/lib/config/app-config'
import { APP_SETTING_KEYS } from '@/lib/config/app-settings-catalog'
import { parseIntent, parseRuleForm, ruleField, sameRuleConfig } from '@/lib/config/rule-config-form'
import { ruleParamFields, ruleParamSchemas } from '@/lib/config/rule-config-schema'
import { RULE_CATALOG, findRuleDefinition } from '@/lib/rules/rule-catalog'

/** A form holding exactly the catalog defaults, i.e. the screen just after a reset. */
function defaultForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData()
  for (const definition of RULE_CATALOG) {
    if (definition.defaultEnabled) form.set(ruleField.enabled(definition.code), 'on')
    form.set(ruleField.severity(definition.code), definition.defaultSeverity)
    for (const [key, value] of Object.entries(definition.defaultParams ?? {})) {
      form.set(ruleField.param(definition.code, key), String(value))
    }
  }
  for (const [name, value] of Object.entries(overrides)) form.set(name, value)
  return form
}

function updateFor(form: FormData, code: string) {
  const result = parseRuleForm(form)
  if (!result.ok) throw new Error(`chờ hợp lệ nhưng lỗi: ${result.message}`)
  return result.updates.find((update) => update.code === code)
}

describe('rule param schemas', () => {
  it('describes exactly the params every rule declares a default for', () => {
    // A threshold with a default but no descriptor would be uneditable; a
    // descriptor with no default would be written into params nothing reads.
    for (const definition of RULE_CATALOG) {
      const declared = Object.keys(definition.defaultParams ?? {}).sort()
      const described = ruleParamFields(definition.code)
        .map((field) => field.key)
        .sort()
      expect(described, definition.code).toEqual(declared)
    }
  })

  it('accepts every catalog default, so a reset can never be rejected', () => {
    for (const [code, schema] of Object.entries(ruleParamSchemas)) {
      const definition = findRuleDefinition(code)
      expect(schema.safeParse(definition?.defaultParams).success, code).toBe(true)
    }
  })
})

describe('parseIntent', () => {
  it('reads the supported actions', () => {
    expect(parseIntent(null)).toEqual({ kind: 'save' })
    expect(parseIntent('reset-all')).toEqual({ kind: 'reset-all' })
    expect(parseIntent('reset:C4')).toEqual({ kind: 'reset', code: 'C4' })
    expect(parseIntent('group-off:E')).toEqual({ kind: 'group', groupCode: 'E', enabled: false })
    expect(parseIntent('group-on:E')).toEqual({ kind: 'group', groupCode: 'E', enabled: true })
  })

  it('refuses codes that are not in the catalog', () => {
    // Otherwise a crafted request could seed a row for a rule that never runs.
    expect(parseIntent('reset:ZZ9')).toBeNull()
    expect(parseIntent('group-off:Z')).toBeNull()
    expect(parseIntent('drop-table')).toBeNull()
  })
})

describe('parseRuleForm', () => {
  it('reads the whole table back unchanged when nothing was touched', () => {
    const result = parseRuleForm(defaultForm())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.updates).toHaveLength(RULE_CATALOG.length)
    expect(result.updates.find((u) => u.code === 'C4')?.params).toEqual({ maxDiscountPercent: 70 })
    expect(result.updates.find((u) => u.code === 'D1')?.enabled).toBe(false)
  })

  it('treats a missing checkbox as switched off', () => {
    const form = defaultForm()
    form.delete(ruleField.enabled('C7'))
    expect(updateFor(form, 'C7')?.enabled).toBe(false)
  })

  it('rejects a threshold outside its range with a Vietnamese message', () => {
    const form = defaultForm({ [ruleField.param('C4', 'maxDiscountPercent')]: '500' })
    const result = parseRuleForm(form)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors[ruleField.param('C4', 'maxDiscountPercent')]).toContain(
      'phải nằm trong khoảng',
    )
    expect(result.message).toContain('chưa hợp lệ')
  })

  it('rejects a blank threshold instead of storing a zero', () => {
    const form = defaultForm({ [ruleField.param('C7', 'roundingUnit')]: '  ' })
    const result = parseRuleForm(form)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors[ruleField.param('C7', 'roundingUnit')]).toContain('không được để trống')
  })

  it('rejects a severity that is not one of the three levels', () => {
    const form = defaultForm({ [ruleField.severity('A1')]: 'catastrophic' })
    expect(parseRuleForm(form).ok).toBe(false)
  })

  it('switches a whole group off while keeping the pending edits', () => {
    const form = defaultForm({
      intent: 'group-off:E',
      [ruleField.param('C4', 'maxDiscountPercent')]: '50',
    })
    const result = parseRuleForm(form)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const groupE = result.updates.filter((u) => u.code.startsWith('E'))
    expect(groupE.map((u) => u.code)).toEqual(['E1', 'E2', 'E3'])
    expect(groupE.every((u) => !u.enabled)).toBe(true)
    expect(result.updates.find((u) => u.code === 'C4')?.params).toEqual({ maxDiscountPercent: 50 })
  })

  it('switches a whole group back on', () => {
    const form = defaultForm({ intent: 'group-on:D' })
    const result = parseRuleForm(form)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // D1 and D2 ship disabled, so this proves the switch overrides the form.
    expect(result.updates.filter((u) => u.code.startsWith('D')).every((u) => u.enabled)).toBe(true)
  })

  it('resets one rule even when its input currently holds an invalid value', () => {
    // The reset button has to be the way out of a bad value, not a victim of it.
    const form = defaultForm({
      intent: 'reset:C4',
      [ruleField.param('C4', 'maxDiscountPercent')]: '500',
    })
    expect(updateFor(form, 'C4')).toEqual({
      code: 'C4',
      enabled: true,
      severity: 'warn',
      params: { maxDiscountPercent: 70 },
    })
  })

  it('resets everything back to the catalog', () => {
    const form = defaultForm({
      intent: 'reset-all',
      [ruleField.param('D7', 'maxDurationDays')]: 'không phải số',
      [ruleField.severity('A1')]: 'catastrophic',
    })
    const result = parseRuleForm(form)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const definition of RULE_CATALOG) {
      const update = result.updates.find((u) => u.code === definition.code)
      expect(update?.enabled, definition.code).toBe(definition.defaultEnabled)
      expect(update?.severity, definition.code).toBe(definition.defaultSeverity)
    }
  })
})

describe('sameRuleConfig', () => {
  const base = { enabled: true, severity: 'warn', params: { maxDiscountPercent: 70 } }
  const update = { code: 'C4', enabled: true, severity: 'warn' as const, params: { maxDiscountPercent: 70 } }

  it('spots an unchanged row so its updatedAt is not bumped', () => {
    expect(sameRuleConfig(base, update)).toBe(true)
  })

  it('spots a change in any of the three fields', () => {
    expect(sameRuleConfig({ ...base, enabled: false }, update)).toBe(false)
    expect(sameRuleConfig({ ...base, severity: 'danger' }, update)).toBe(false)
    expect(sameRuleConfig({ ...base, params: { maxDiscountPercent: 50 } }, update)).toBe(false)
    expect(sameRuleConfig({ ...base, params: {} }, update)).toBe(false)
  })
})

describe('validateSettingValue', () => {
  it('accepts a value the runtime would accept', () => {
    expect(validateSettingValue(APP_SETTING_KEYS.catalogMaxAgeHours, '6')).toEqual({ ok: true })
  })

  it('refuses a page size above what Haravan serves, in Vietnamese', () => {
    const result = validateSettingValue(APP_SETTING_KEYS.haravanPageSize, '250')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe('Giá trị tối đa cho phép là 50.')
  })

  it('refuses blank, non-numeric and fractional counts', () => {
    for (const raw of ['', '   ', 'abc', '1.5']) {
      expect(validateSettingValue(APP_SETTING_KEYS.haravanPageSize, raw).ok, raw).toBe(false)
    }
  })

  it('keeps the Haravan token from being sent to another host', () => {
    const result = validateSettingValue(APP_SETTING_KEYS.haravanApiBase, 'https://evil.example.com')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('haravan.com')
  })

  it('refuses a key that is not part of the app configuration', () => {
    expect(validateSettingValue('rm.rf', '1').ok).toBe(false)
  })
})
