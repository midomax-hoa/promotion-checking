/**
 * Resolves the per-rule configuration the engine runs with.
 *
 * `RuleConfig` rows are operator-editable, so nothing read from them is
 * trusted: an unknown severity, a params blob that is not an object, or a row
 * that was never seeded all fall back to the catalog default rather than
 * throwing. A configuration screen must never be able to break a check run.
 *
 * Rows for codes that are not in the catalog are dropped - they can only be
 * leftovers from a renamed rule.
 */

import { prisma } from '@/lib/db/prisma'
import { RULE_CATALOG, type RuleDefinition } from './rule-catalog'
import type { RuleParams, Severity } from './types'

export type RuleConfigInput = {
  code: string
  enabled: boolean
  severity: Severity
  params: RuleParams
}

/** Shape of one `RuleConfig` row, narrowed to what this module reads. */
export type RuleConfigRow = {
  code: string
  enabled: boolean
  severity: string
  params: unknown
}

const SEVERITIES: readonly Severity[] = ['critical', 'danger', 'warn']

function toSeverity(raw: string, fallback: Severity): Severity {
  return (SEVERITIES as readonly string[]).includes(raw) ? (raw as Severity) : fallback
}

/** Keeps only JSON scalars, so a rule can never receive a nested object it cannot use. */
function toParams(raw: unknown, fallback: RuleParams | undefined): RuleParams {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback }
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    (entry): entry is [string, number | string | boolean] =>
      ['number', 'string', 'boolean'].includes(typeof entry[1]),
  )
  // Stored values win, but a threshold the operator never touched keeps its default.
  return { ...fallback, ...Object.fromEntries(entries) }
}

function fromDefinition(definition: RuleDefinition): RuleConfigInput {
  return {
    code: definition.code,
    enabled: definition.defaultEnabled,
    severity: definition.defaultSeverity,
    params: { ...definition.defaultParams },
  }
}

/** Pure merge, so the fallback behaviour can be tested without a database. */
export function mergeRuleConfigs(rows: readonly RuleConfigRow[]): RuleConfigInput[] {
  const byCode = new Map(rows.map((row) => [row.code, row]))

  return RULE_CATALOG.map((definition) => {
    const row = byCode.get(definition.code)
    if (row == null) return fromDefinition(definition)
    return {
      code: definition.code,
      enabled: row.enabled,
      severity: toSeverity(row.severity, definition.defaultSeverity),
      params: toParams(row.params, definition.defaultParams),
    }
  })
}

export async function loadRuleConfigs(): Promise<RuleConfigInput[]> {
  const rows = await prisma.ruleConfig.findMany({
    select: { code: true, enabled: true, severity: true, params: true },
  })
  return mergeRuleConfigs(rows)
}
