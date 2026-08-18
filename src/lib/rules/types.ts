/**
 * Contracts shared by every checking rule.
 *
 * A rule is a pure function: workbook + catalog in, findings out. No network, no
 * filesystem, no clock of its own - `now` is handed in so a test can pin it.
 * That is what makes the 31 rules cheap to test one by one and safe to run in
 * any order.
 *
 * Percentage convention, stated once because mixing the two forms is the
 * easiest way to ship a wrong promotion: inside the Excel file and inside a
 * `PromotionRow`, a percentage is always a **decimal fraction** (0.5 = 50%).
 * Only the message formatter and the Haravan payload multiply by 100.
 */

import type { CatalogIndex } from '@/lib/catalog/catalog-index'
import type { WorkbookReadResult } from '@/lib/excel/types'
import type { GroupCode, RuleParams, Severity } from './rule-catalog'

export type { GroupCode, RuleParams, Severity }

/** Groups A-E run before import; F reconciles afterwards and lands in phase 06. */
export type CheckGroupCode = Exclude<GroupCode, 'F'>

/**
 * A promotion already living on Haravan, normalised to what the rules need.
 *
 * Deliberately not the raw API shape: D8 and E3 only care about the name, the
 * window and the attached SKUs. Phase 06 fetches the real thing and maps it
 * into this, so a change in Haravan's JSON never reaches a rule.
 */
export type HaravanPromotion = {
  id: string
  name: string
  startAt: Date | null
  /** null = open ended. */
  endAt: Date | null
  active: boolean
  /** Normalised SKUs (see `normalizeSku`). Empty when the attachment is unknown. */
  skus: string[]
}

/**
 * Data a rule may read. `null` never means "nothing found" - it means "not
 * loaded", and the engine skips the rules that need it rather than letting them
 * conclude an absence.
 */
export type RuleContext = {
  workbook: WorkbookReadResult
  catalog: CatalogIndex
  /** null = not fetched; rules requiring it are skipped, not silently passed. */
  haravanPromotions: HaravanPromotion[] | null
  now: Date
  /** From AppSetting `money.tolerance_vnd`; every money comparison goes through it. */
  moneyToleranceVnd: number
  /** Params of the rule currently running, already merged with its catalog defaults. */
  params: RuleParams
}

/** One problem found in one place, in Vietnamese, with the numbers spelled out. */
export type RuleFinding = {
  sheetName?: string
  rowNumber?: number
  programName?: string
  sku?: string
  message: string
  suggestion?: string
}

/** External data a rule cannot work without. Unmet -> the rule is skipped. */
export type RuleRequirement = 'catalog' | 'haravan-promotions'

export type Rule = {
  code: string
  groupCode: CheckGroupCode
  requires?: readonly RuleRequirement[]
  run(ctx: RuleContext): RuleFinding[]
}

/** Reads a numeric threshold, falling back when the stored params are unusable. */
export function numberParam(params: RuleParams, key: string, fallback: number): number {
  const raw = params[key]
  const value = typeof raw === 'string' ? Number(raw) : raw
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
