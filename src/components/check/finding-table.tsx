/**
 * The flat, filtered, paginated list of findings.
 *
 * The page it renders was already cut in PostgreSQL, so the browser receives
 * one page's worth of rows no matter how big the run is. Paging is links, for
 * the same reason the filters are.
 */

import Link from 'next/link'
import { filterHref, type FindingFilter } from '@/lib/check/finding-filter'
import type { FindingPage } from '@/lib/check/finding-queries'
import { FindingList } from './finding-row'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NUMBER = new Intl.NumberFormat('vi-VN')
const PAGE_LINK = buttonVariants({ variant: 'outline', size: 'sm' })

export function FindingTable({
  basePath,
  filter,
  page,
}: {
  basePath: string
  filter: FindingFilter
  page: FindingPage
}) {
  const first = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1
  const last = Math.min(page.page * page.pageSize, page.total)

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {page.total === 0
          ? 'Không có phát hiện nào khớp bộ lọc.'
          : `Hiện ${NUMBER.format(first)}–${NUMBER.format(last)} trong ${NUMBER.format(page.total)} phát hiện.`}
      </p>

      <div className="overflow-x-auto rounded-lg border px-4">
        <FindingList findings={page.items} showProgram />
      </div>

      {page.pageCount > 1 ? (
        <nav className="flex items-center gap-3" aria-label="Phân trang">
          <PageLink
            basePath={basePath}
            filter={filter}
            target={page.page - 1}
            disabled={page.page <= 1}
            label="Trang trước"
          />
          <span className="text-sm tabular-nums text-muted-foreground">
            Trang {page.page} / {page.pageCount}
          </span>
          <PageLink
            basePath={basePath}
            filter={filter}
            target={page.page + 1}
            disabled={page.page >= page.pageCount}
            label="Trang sau"
          />
        </nav>
      ) : null}
    </section>
  )
}

function PageLink({
  basePath,
  filter,
  target,
  disabled,
  label,
}: {
  basePath: string
  filter: FindingFilter
  target: number
  disabled: boolean
  label: string
}) {
  if (disabled) {
    return (
      <span aria-disabled className={cn(PAGE_LINK, 'opacity-40')}>
        {label}
      </span>
    )
  }
  return (
    <Link href={filterHref(basePath, filter, { page: target })} className={PAGE_LINK}>
      {label}
    </Link>
  )
}
