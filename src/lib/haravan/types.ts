/**
 * Haravan response shapes.
 *
 * Written from real calls against the dev store on 2026-08-17, NOT from the
 * public documentation - the docs disagree with the API in at least one place
 * (`discount_type` is documented as `fixed_amount`/`percentage`, the API
 * actually returns `product_amount` plus a separate `take_type`).
 *
 * Verified sample (`GET /com/products.json?limit=2&fields=...`):
 *   { "id": 1075675388, "title": "1C Test Haravan", "published_at": null,
 *     "published_scope": null, "updated_at": "2026-08-11T02:52:12.63Z",
 *     "only_hide_from_list": false, "not_allow_promotion": false,
 *     "variants": [ { "id": 1172575146, "product_id": 1075675388,
 *       "sku": null, "barcode": null, "title": "Vàng xanh / 100",
 *       "price": 0, "compare_at_price": 0, "inventory_quantity": -4, ... } ] }
 */

/** Ids come back as JSON numbers below 2^53, so BigInt(id) is exact. */
export type HaravanId = number

export type HaravanVariant = {
  id: HaravanId
  product_id: HaravanId
  sku: string | null
  barcode: string | null
  title: string | null
  price: number
  compare_at_price: number | null
  inventory_quantity: number | null
  updated_at?: string
}

export type HaravanProduct = {
  id: HaravanId
  title: string
  /** null = never published, i.e. not on sale yet -> rule B2. */
  published_at: string | null
  /** 'global' | 'pos' | null on the dev store. Stored, not used yet. */
  published_scope: string | null
  /** Product excluded from promotions -> rule B6. */
  not_allow_promotion?: boolean
  only_hide_from_list?: boolean
  updated_at: string
  variants: HaravanVariant[]
}

export type ProductListResponse = { products: HaravanProduct[] }

export type ProductCountResponse = { count: number }

/**
 * Sort order of `GET /com/products.json`, measured on 2026-08-17: **id
 * descending**, checked across all 74 dev-store products over two pages. Not
 * `updated_at`, which was the worry for page-based paging.
 *
 * Why it matters: editing a product mid-sync does not move it, so page-based
 * paging is stable against edits. A product created mid-sync gets a higher id
 * and lands at the front, pushing the page boundary down - that re-serves one
 * product rather than skipping it, and the writes are idempotent.
 */

/**
 * `fields` accepted by `GET /com/products.json`, verified one by one.
 * Kept as a single constant so the sync and any future caller stay in step.
 */
export const PRODUCT_FIELDS = [
  'id',
  'title',
  'published_at',
  'published_scope',
  'not_allow_promotion',
  'only_hide_from_list',
  'updated_at',
  'variants',
].join(',')

export const PRODUCTS_PATH = '/com/products.json'
export const PRODUCTS_COUNT_PATH = '/com/products/count.json'
