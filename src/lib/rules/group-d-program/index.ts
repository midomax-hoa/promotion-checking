import type { Rule } from '../types'
import { d1NameValueMismatch } from './d1-name-value-mismatch'
import { d2NameMonthMismatch } from './d2-name-month-mismatch'
import { d3InconsistentProgram } from './d3-inconsistent-program'
import { d4StartDatePassed } from './d4-start-date-passed'
import { d5EndDatePassed } from './d5-end-date-passed'
import { d6EndBeforeStart } from './d6-end-before-start'
import { d7UnusualDuration } from './d7-unusual-duration'
import { d8ProgramNameExists } from './d8-program-name-exists'
import { d9InvalidUsageLimit } from './d9-invalid-usage-limit'
import { d10InconsistentUsageLimit } from './d10-inconsistent-usage-limit'

/**
 * Group D - one promotion program at a time.
 *
 * Most findings here are per program rather than per row: Haravan creates one
 * promotion per `Tên ctkm`, so a wrong end date is one problem, not 279.
 */
export const GROUP_D_RULES: readonly Rule[] = [
  d1NameValueMismatch,
  d2NameMonthMismatch,
  d3InconsistentProgram,
  d4StartDatePassed,
  d5EndDatePassed,
  d6EndBeforeStart,
  d7UnusualDuration,
  d8ProgramNameExists,
  d9InvalidUsageLimit,
  d10InconsistentUsageLimit,
]
