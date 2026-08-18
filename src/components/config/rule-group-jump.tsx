/**
 * Jump straight to a rule group.
 *
 * 37 rules in six groups is a long scroll, and without this the only way to
 * reach group F is to recognise it going past. Deliberately plain anchors
 * rendered *outside* the rule form: the one-form-one-save decision is what
 * stops a half-saved configuration, and a jump list is not worth risking it.
 */

import { GROUP_CODES, GROUP_TITLES } from '@/lib/rules/rule-catalog'
import { ruleGroupAnchor } from '@/lib/config/rule-group-anchor'

export function RuleGroupJump() {
  return (
    <nav
      aria-label="Nhảy tới nhóm luật"
      className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1.5 rounded-lg border bg-background/95 px-3 py-2 backdrop-blur"
    >
      <span className="pr-1 text-xs text-muted-foreground">Nhảy tới nhóm:</span>
      {GROUP_CODES.map((groupCode) => (
        <a
          key={groupCode}
          href={`#${ruleGroupAnchor(groupCode)}`}
          // The full title is the accessible name; the letter is what fits.
          title={GROUP_TITLES[groupCode]}
          className="rounded-md border px-2.5 py-1 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span aria-hidden>{groupCode}</span>
          <span className="sr-only">{GROUP_TITLES[groupCode]}</span>
        </a>
      ))}
    </nav>
  )
}
