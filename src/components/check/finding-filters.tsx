/**
 * The filter bar. Every control is a link or a GET form, so the current filter
 * always lives in the address bar: reloading keeps it, and a colleague can be
 * sent the exact view being discussed.
 *
 * No `onChange`, no `useState`. The server does the filtering.
 */

import Link from 'next/link'
import { filterHref, isFilterActive, type FindingFilter } from '@/lib/check/finding-filter'
import { SEVERITY_META, SEVERITY_ORDER } from './severity-badge'
import { cn } from '@/lib/utils'

/** Hidden inputs keep the other filters alive when the search form submits. */
function CarriedFilters({
  filter,
  except,
}: {
  filter: FindingFilter
  except: readonly ('muc' | 'luat' | 'ctkm' | 'sku' | 'mo')[]
}) {
  const entries: [string, string | null][] = [
    ['muc', filter.severity],
    ['luat', filter.ruleCode],
    ['ctkm', filter.program],
    ['sku', filter.sku],
    ['mo', filter.expandedProgram],
  ]
  return (
    <>
      {entries
        .filter(([key, value]) => value && !except.includes(key as 'muc'))
        .map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value ?? ''} />
        ))}
    </>
  )
}

const PILL = 'rounded-md border px-3 py-1 text-sm whitespace-nowrap hover:bg-muted'
const PILL_ACTIVE = 'border-foreground bg-foreground text-background hover:bg-foreground'

export function FindingFilters({
  basePath,
  filter,
  ruleCodes,
}: {
  basePath: string
  filter: FindingFilter
  ruleCodes: readonly { code: string; count: number }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={filterHref(basePath, filter, { severity: null })}
        className={cn(PILL, filter.severity === null && PILL_ACTIVE)}
      >
        Tất cả
      </Link>
      {SEVERITY_ORDER.map((severity) => (
        <Link
          key={severity}
          href={filterHref(basePath, filter, { severity })}
          title={SEVERITY_META[severity].label}
          className={cn(PILL, filter.severity === severity && PILL_ACTIVE)}
        >
          <span aria-hidden className="mr-1">
            {SEVERITY_META[severity].dot}
          </span>
          {SEVERITY_META[severity].short}
        </Link>
      ))}

      <form method="get" action={basePath} className="flex flex-wrap items-center gap-2">
        <CarriedFilters filter={filter} except={['luat', 'sku', 'ctkm']} />
        <select
          name="luat"
          defaultValue={filter.ruleCode ?? ''}
          className="h-8 rounded-md border bg-background px-2 text-sm"
          aria-label="Lọc theo mã luật"
        >
          <option value="">Mọi mã luật</option>
          {ruleCodes.map((rule) => (
            <option key={rule.code} value={rule.code}>
              {rule.code} ({rule.count})
            </option>
          ))}
        </select>
        <input
          type="search"
          name="sku"
          defaultValue={filter.sku ?? ''}
          placeholder="Tìm SKU"
          className="h-8 w-32 rounded-md border bg-background px-2 text-sm"
          aria-label="Tìm theo mã hiệu"
        />
        <input
          type="search"
          name="ctkm"
          defaultValue={filter.program ?? ''}
          placeholder="Tìm chương trình"
          className="h-8 w-40 rounded-md border bg-background px-2 text-sm"
          aria-label="Tìm theo tên chương trình"
        />
        <button type="submit" className={PILL}>
          Lọc
        </button>
      </form>

      {isFilterActive(filter) ? (
        <Link href={basePath} className={cn(PILL, 'text-muted-foreground')}>
          Xoá bộ lọc
        </Link>
      ) : null}
    </div>
  )
}
