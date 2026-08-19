'use server'

/**
 * Writes the configuration screen back to the database.
 *
 * Only rows whose values actually changed are written, so `RuleConfig.updatedAt`
 * keeps meaning "when this rule was last tuned" rather than "when someone last
 * opened the screen" - that timestamp is the only audit trail the tool has.
 */

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
import { findRuleDefinition } from '@/lib/rules/rule-catalog'
import { loadRuleConfigs } from '@/lib/rules/rule-config-store'
import { parseRuleForm, sameRuleConfig } from '@/lib/config/rule-config-form'
import { EDITABLE_SETTING_KEYS, validateSettingValue } from '@/lib/config/app-config'
import { defaultSettingValue } from '@/lib/config/app-settings-catalog'
import { settingField, type ConfigFormState } from '@/lib/config/config-form-state'

const PAGE_PATH = '/cau-hinh'

/** Everything the form submitted, so a rejected value can be shown back unchanged. */
function rawValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[0] !== 'intent',
    ),
  )
}

function savedState(prev: ConfigFormState, changed: number, noun: string): ConfigFormState {
  return {
    status: 'saved',
    message: changed === 0 ? 'Không có gì thay đổi.' : `Đã lưu ${changed} ${noun}.`,
    version: prev.version + 1,
  }
}

export async function saveRuleConfigsAction(
  prev: ConfigFormState,
  formData: FormData,
): Promise<ConfigFormState> {
  // A Server Action is a POST endpoint of its own: reachable without ever
  // loading the screen that renders it, so it carries its own check.
  await requireUser()

  const parsed = parseRuleForm(formData)
  if (!parsed.ok) {
    return {
      status: 'error',
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
      values: rawValues(formData),
      version: prev.version + 1,
    }
  }

  const current = new Map((await loadRuleConfigs()).map((config) => [config.code, config]))
  const changed = parsed.updates.filter((update) => {
    const existing = current.get(update.code)
    return existing == null || !sameRuleConfig(existing, update)
  })

  if (changed.length > 0) {
    await prisma.$transaction(
      changed.map((update) => {
        // Non-null: every code comes from RULE_CATALOG, never from the form.
        const definition = findRuleDefinition(update.code)!
        const values = {
          enabled: update.enabled,
          severity: update.severity,
          params: update.params,
        }
        return prisma.ruleConfig.upsert({
          where: { code: update.code },
          update: values,
          create: {
            code: update.code,
            groupCode: definition.groupCode,
            title: definition.title,
            ...values,
          },
        })
      }),
    )
    revalidatePath(PAGE_PATH)
  }
  return savedState(prev, changed.length, 'luật')
}

export async function saveAppSettingsAction(
  prev: ConfigFormState,
  formData: FormData,
): Promise<ConfigFormState> {
  await requireUser()

  const intent = String(formData.get('intent') ?? 'save')
  const resetKey = intent.startsWith('reset:') ? intent.slice('reset:'.length) : null
  if (
    intent !== 'save' &&
    intent !== 'reset-all' &&
    !EDITABLE_SETTING_KEYS.includes(resetKey ?? '')
  ) {
    return { status: 'error', message: 'Thao tác không hợp lệ.', version: prev.version + 1 }
  }

  const fieldErrors: Record<string, string> = {}
  const values = new Map<string, string>()
  for (const key of EDITABLE_SETTING_KEYS) {
    const fallback = defaultSettingValue(key)
    if (intent === 'reset-all' || resetKey === key) {
      if (fallback != null) values.set(key, fallback)
      continue
    }
    const raw = String(formData.get(settingField(key)) ?? '').trim()
    const check = validateSettingValue(key, raw)
    if (check.ok) values.set(key, raw)
    else fieldErrors[settingField(key)] = check.message
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      message: 'Có giá trị chưa hợp lệ nên chưa lưu được. Xem chi tiết ngay dưới ô nhập.',
      fieldErrors,
      values: rawValues(formData),
      version: prev.version + 1,
    }
  }

  const stored = new Map((await prisma.appSetting.findMany()).map((row) => [row.key, row.value]))
  const changed = [...values].filter(([key, value]) => stored.get(key) !== value)

  if (changed.length > 0) {
    await prisma.$transaction(
      changed.map(([key, value]) =>
        prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
      ),
    )
    revalidatePath(PAGE_PATH)
  }
  return savedState(prev, changed.length, 'thiết lập')
}
