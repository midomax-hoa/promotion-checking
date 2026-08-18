/**
 * Near-match suggestion for rule B1 ("SKU 'X' does not exist - did you mean 'Y'?").
 *
 * Two filters cut the work before any distance is computed: candidates must
 * share the first `PREFIX_LENGTH` characters, and their length must be within
 * the edit budget. Distance itself uses one rolling row and abandons a
 * candidate as soon as the whole row exceeds the budget.
 *
 * That is still not enough on its own. Measured on `promotion.t8.xlsx`
 * (2026-08-18) the 3.931 SKUs fall into just 24 three-character buckets, the
 * largest holding 31% of them - this store's codes nearly all begin `km`. So
 * when the catalog holds none of the file's SKUs (a stale sync, or a token
 * pointing at the wrong store) every one of 3.931 lookups scans a third of the
 * catalog: 83 seconds against a 3-second budget, measured.
 *
 * Hence the comparison budget. It is spent across the whole run, and once it is
 * gone `findClosest` returns null instead of searching. The findings still all
 * appear - only the "did you mean" hint stops, and B1 says so. That trade is
 * deliberate: when thousands of SKUs are unknown, the useful advice is "re-sync
 * the catalog", not a guess at each individual code.
 */

const PREFIX_LENGTH = 3

/** ~0.7 s of searching, measured at roughly 350 ns per candidate comparison. */
export const DEFAULT_COMPARISON_BUDGET = 2_000_000

/**
 * Edit distance between two strings, capped: any result above `max` is reported
 * as `max + 1` rather than computed exactly, which is all the caller needs.
 */
export function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1

  let previous = new Array<number>(b.length + 1)
  let current = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) previous[j] = j

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, substitution)
      current[j] = value
      if (value < rowMin) rowMin = value
    }
    // Every later row is >= this one's minimum, so the budget can never be met.
    if (rowMin > max) return max + 1
    // Swap rather than copy: this loop runs millions of times per check run.
    const swap = previous
    previous = current
    current = swap
  }

  return previous[b.length]
}

export type SimilarityIndex = {
  /** Leading-characters bucket -> the candidates starting with them. */
  buckets: Map<string, string[]>
  /** Candidate comparisons still allowed this run; 0 means searching has stopped. */
  budget: number
}

export function buildSimilarityIndex(
  candidates: readonly string[],
  budget: number = DEFAULT_COMPARISON_BUDGET,
): SimilarityIndex {
  const buckets = new Map<string, string[]>()
  for (const candidate of candidates) {
    const key = candidate.slice(0, PREFIX_LENGTH)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(candidate)
    else buckets.set(key, [candidate])
  }
  return { buckets, budget: Math.max(0, budget) }
}

/** True once the run has spent its whole suggestion budget. */
export function isBudgetExhausted(index: SimilarityIndex): boolean {
  return index.budget <= 0
}

/**
 * Closest candidate within `maxDistance`, or null when nothing is close enough
 * - or when the run has no comparison budget left.
 */
export function findClosest(
  index: SimilarityIndex,
  target: string,
  maxDistance: number,
): string | null {
  if (index.budget <= 0) return null

  const bucket = index.buckets.get(target.slice(0, PREFIX_LENGTH))
  if (!bucket) return null

  let best: string | null = null
  let bestDistance = maxDistance + 1

  for (const candidate of bucket) {
    if (index.budget <= 0) break
    index.budget -= 1
    if (Math.abs(candidate.length - target.length) > maxDistance) continue
    const distance = levenshtein(target, candidate, bestDistance - 1)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
      if (distance === 1) break // Cannot do better than one edit away.
    }
  }

  return best
}
