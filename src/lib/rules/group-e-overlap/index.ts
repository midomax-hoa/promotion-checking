import type { Rule } from '../types'
import { e1SkuInOverlappingPrograms } from './e1-sku-in-overlapping-programs'
import { e2DuplicateSkuInProgram } from './e2-duplicate-sku-in-program'
import { e3SkuInLiveHaravanPromotion } from './e3-sku-in-live-haravan-promotion'

/** Group E - one SKU covered by more than one promotion at the same time. */
export const GROUP_E_RULES: readonly Rule[] = [
  e1SkuInOverlappingPrograms,
  e2DuplicateSkuInProgram,
  e3SkuInLiveHaravanPromotion,
]
