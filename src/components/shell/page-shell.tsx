/**
 * The frame every screen sits in: title, description, actions, content.
 *
 * It exists because the same `mx-auto flex max-w-4xl flex-col gap-6 p-8` had
 * been copied into seven pages, which made "widen the content" a seven-file
 * change that was certain to miss one.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Three widths rather than a number per page. The upload and sync screens read
 * better narrow; the finding table and the three-column comparison need every
 * pixel they can get.
 */
const WIDTHS = {
  narrow: 'max-w-3xl',
  medium: 'max-w-5xl',
  full: 'max-w-none',
} as const

export type PageWidth = keyof typeof WIDTHS

export function PageShell({
  title,
  description,
  actions,
  width = 'medium',
  children,
}: {
  title: string
  description?: ReactNode
  /** Rendered opposite the title - export buttons, back links. */
  actions?: ReactNode
  width?: PageWidth
  children: ReactNode
}) {
  return (
    <div className={cn('mx-auto flex w-full flex-col gap-6 px-5 py-8 lg:px-8', WIDTHS[width])}>
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description ? (
            // Capped independently of the page width: a description stretched
            // across a 1920px screen is a line nobody can follow back.
            <p className="max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}
