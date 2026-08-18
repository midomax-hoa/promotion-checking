/**
 * Runs reconciliation and decides what may be reported.
 *
 * The two-pass mechanism is the whole design, and it exists because of one
 * measured fact: Haravan's promotion list lags roughly five seconds behind a
 * create, while fetching a promotion by id is immediate. Reconciling right after
 * an import therefore finds nothing and would report every program as missing -
 * hundreds of critical findings about a flawless import.
 *
 * So a program is only called missing when two fetches, separated by
 * `reconcile.recheck_delay_ms`, both fail to find it:
 *
 *   pass 1 -> set A of names not found
 *      wait
 *   pass 2 -> set B of names not found
 *   report only A ∩ B; A ≠ B means the index was still settling
 *
 * The wait is skipped when A is empty. An empty intersection is then guaranteed
 * whatever pass 2 would have said, so the delay would buy nothing but eight
 * seconds of staring at a spinner.
 *
 * No rule is asked to be careful about any of this. By the time the matches
 * reach group F they are already the agreed ones.
 */

import type { CatalogIndex } from '@/lib/catalog/catalog-index'
import type { WorkbookReadResult } from '@/lib/excel/types'
import type { RawHaravanPromotion } from '@/lib/haravan/promotion-types'
import type { EngineFinding } from '@/lib/rules/engine'
import type { RuleConfigInput } from '@/lib/rules/rule-config-store'
import type { Severity } from '@/lib/rules/types'
import { GROUP_F_RULES } from './group-f-reconcile'
import { mapPromotions } from './promotion-mapper'
import { matchPrograms, notFoundNames } from './promotion-matcher'
import {
  ambiguousFindings,
  countBySeverity,
  DISAGREED_FINDING,
  keepAgreedFindings,
  sortFindings,
} from './reconcile-findings'
import type { MatchResult, ReconcileRule } from './types'

export type ReconcileOptions = {
  /** From AppSetting `reconcile.recheck_delay_ms`. */
  recheckDelayMs: number
  /** From AppSetting `shop.timezone_offset_minutes`. */
  shopTimezoneOffsetMinutes: number
  /** From AppSetting `check.money_tolerance_vnd`. */
  moneyToleranceVnd: number
  configs: readonly RuleConfigInput[]
  /** Defaults to the six group F rules; a test can pass one. */
  rules?: readonly ReconcileRule[]
}

export type ReconcileDeps = {
  /** Called once per pass. Returns the raw promotion list as Haravan gave it. */
  fetchPromotions: (pass: 1 | 2) => Promise<RawHaravanPromotion[]>
  catalog: CatalogIndex
  sleep?: (ms: number) => Promise<void>
  onProgress?: (progress: ReconcileProgress) => void
}

export type ReconcileProgress = {
  phase: 'pass-1' | 'waiting' | 'pass-2' | 'rules'
  pass: 1 | 2
  promotions: number
  notFound: number
}

export type ReconcileResult = {
  matches: MatchResult[]
  findings: EngineFinding[]
  counts: Record<Severity, number>
  skippedRules: string[]
  /** false = the two passes disagreed; the screen suggests running again. */
  passesAgreed: boolean
  /** 1 when the first pass found everything and the second was not needed. */
  passesRun: 1 | 2
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function reconcile(
  workbook: WorkbookReadResult,
  options: ReconcileOptions,
  deps: ReconcileDeps,
): Promise<ReconcileResult> {
  const { catalog, fetchPromotions, sleep = defaultSleep, onProgress } = deps
  const matchOptions = { shopTimezoneOffsetMinutes: options.shopTimezoneOffsetMinutes }

  const firstRaw = await fetchPromotions(1)
  let matches = matchPrograms(workbook, mapPromotions(firstRaw, catalog), matchOptions)
  const firstMissing = notFoundNames(matches)
  onProgress?.({
    phase: 'pass-1',
    pass: 1,
    promotions: firstRaw.length,
    notFound: firstMissing.size,
  })

  let passesRun: 1 | 2 = 1
  const disputed = new Set<string>()

  // Nothing missing means the intersection is empty whatever a second pass says,
  // so the delay would only cost the user time.
  if (firstMissing.size > 0) {
    onProgress?.({
      phase: 'waiting',
      pass: 1,
      promotions: firstRaw.length,
      notFound: firstMissing.size,
    })
    await sleep(options.recheckDelayMs)

    const secondRaw = await fetchPromotions(2)
    matches = matchPrograms(workbook, mapPromotions(secondRaw, catalog), matchOptions)
    const secondMissing = notFoundNames(matches)
    passesRun = 2

    // Names the first pass missed and the second found: index lag, not a problem.
    // The reverse - found then missing - is just as much a disagreement.
    for (const name of firstMissing) if (!secondMissing.has(name)) disputed.add(name)
    for (const name of secondMissing) if (!firstMissing.has(name)) disputed.add(name)

    onProgress?.({
      phase: 'pass-2',
      pass: 2,
      promotions: secondRaw.length,
      notFound: secondMissing.size,
    })
  }

  onProgress?.({ phase: 'rules', pass: passesRun, promotions: 0, notFound: disputed.size })

  const configByCode = new Map(options.configs.map((config) => [config.code, config]))
  const rules = options.rules ?? GROUP_F_RULES
  const raw: EngineFinding[] = []
  const skippedRules: string[] = []

  for (const rule of rules) {
    const config = configByCode.get(rule.code)
    // A rule with no configuration row is treated as off, the same way the
    // checking engine does: running it would apply a severity nobody chose.
    if (config == null || !config.enabled) {
      skippedRules.push(rule.code)
      continue
    }
    const findings = rule.run({
      matches,
      catalog,
      moneyToleranceVnd: options.moneyToleranceVnd,
      shopTimezoneOffsetMinutes: options.shopTimezoneOffsetMinutes,
      params: config.params,
    })
    for (const finding of findings) {
      raw.push({ ...finding, ruleCode: rule.code, severity: config.severity })
    }
  }

  const passesAgreed = disputed.size === 0
  const findings = sortFindings([
    ...keepAgreedFindings(raw, disputed),
    ...ambiguousFindings(matches, options.shopTimezoneOffsetMinutes),
    ...(passesAgreed ? [] : [DISAGREED_FINDING]),
  ])

  return {
    matches,
    findings,
    counts: countBySeverity(findings),
    skippedRules,
    passesAgreed,
    passesRun,
  }
}
