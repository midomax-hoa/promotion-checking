/**
 * Runs the enabled rules over one workbook and collects their findings.
 *
 * The single most important thing this file does is refuse to guess. When the
 * catalog cache is empty or was never synced, group B would report all 3.929
 * SKUs as "does not exist on Haravan" - technically what the data says, and
 * completely wrong. So the rules that need external data declare it, and the
 * engine skips them and says so.
 *
 * Missing input is reported as missing input. It is never turned into a
 * conclusion.
 */

import { RULE_CODES, SYSTEM_RULE_CATALOG_EMPTY } from './rule-catalog'
import { RULES } from './registry'
import type { RuleConfigInput } from './rule-config-store'
import type { Rule, RuleContext, RuleFinding, RuleRequirement, Severity } from './types'

export type EngineFinding = RuleFinding & { ruleCode: string; severity: Severity }

export type RunRulesResult = {
  findings: EngineFinding[]
  counts: Record<Severity, number>
  /** Rules that did not run - switched off, or missing the data they need. */
  skippedRules: string[]
}

export type RunRulesInput = Omit<RuleContext, 'params'> & {
  configs: readonly RuleConfigInput[]
  /** Defaults to the full registry; a test can pass a single rule. */
  rules?: readonly Rule[]
}

/** Report order: worst first, then catalog order, then by position in the file. */
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, danger: 1, warn: 2 }
const CATALOG_ORDER = new Map(RULE_CODES.map((code, index) => [code, index]))

function ruleOrder(code: string): number {
  return CATALOG_ORDER.get(code) ?? Number.MAX_SAFE_INTEGER
}

function compareFindings(a: EngineFinding, b: EngineFinding): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    ruleOrder(a.ruleCode) - ruleOrder(b.ruleCode) ||
    (a.rowNumber ?? 0) - (b.rowNumber ?? 0)
  )
}

/**
 * Which external inputs are actually available. A catalog that exists but holds
 * nothing counts as unavailable - an empty index answers every lookup with
 * "not found", which is the failure mode this guard exists for.
 */
function availableInputs(ctx: Omit<RuleContext, 'params'>): Set<RuleRequirement> {
  const available = new Set<RuleRequirement>()
  if (ctx.catalog.syncedAt !== null && ctx.catalog.bySku.size > 0) available.add('catalog')
  if (ctx.haravanPromotions !== null) available.add('haravan-promotions')
  return available
}

const CATALOG_EMPTY_FINDING: EngineFinding = {
  ruleCode: SYSTEM_RULE_CATALOG_EMPTY,
  severity: 'critical',
  message:
    'Chưa đồng bộ danh mục sản phẩm nên không kiểm tra được mã hiệu (SKU) có tồn tại trên Haravan hay không.',
  suggestion:
    'Vào màn hình Đồng bộ, chạy đồng bộ danh mục rồi kiểm tra lại file. ' +
    'Các luật nhóm B đã bị bỏ qua trong lần kiểm tra này.',
}

export function runRules(input: RunRulesInput): RunRulesResult {
  const { configs, rules = RULES, ...base } = input
  const configByCode = new Map(configs.map((config) => [config.code, config]))
  const available = availableInputs(base)

  const findings: EngineFinding[] = []
  const skippedRules: string[] = []

  for (const rule of rules) {
    const config = configByCode.get(rule.code)
    // A rule with no configuration row at all is treated as off, deliberately:
    // running it would apply a severity nobody chose.
    if (config == null || !config.enabled) {
      skippedRules.push(rule.code)
      continue
    }

    const missing = (rule.requires ?? []).filter((requirement) => !available.has(requirement))
    if (missing.length > 0) {
      skippedRules.push(rule.code)
      continue
    }

    const ctx: RuleContext = { ...base, params: config.params }
    for (const finding of rule.run(ctx)) {
      findings.push({ ...finding, ruleCode: rule.code, severity: config.severity })
    }
  }

  // Only worth saying when a rule actually wanted the catalog.
  if (!available.has('catalog') && rules.some((rule) => rule.requires?.includes('catalog'))) {
    findings.push(CATALOG_EMPTY_FINDING)
  }

  findings.sort(compareFindings)

  const counts: Record<Severity, number> = { critical: 0, danger: 0, warn: 0 }
  for (const finding of findings) counts[finding.severity] += 1

  return { findings, counts, skippedRules }
}
