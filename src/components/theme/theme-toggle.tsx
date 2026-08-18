'use client'

/**
 * Three-state theme switch.
 *
 * A segmented radio group rather than a cycling button: with three states a
 * single button gives no way to see which one is active without clicking
 * through, and "follow the system" is invisible when it happens to match.
 */

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import {
  applyResolvedTheme,
  normalizeThemePreference,
  resolveTheme,
  THEME_LABELS,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme'
import { cn } from '@/lib/utils'

const ICONS: Record<ThemePreference, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function ThemeToggle() {
  // `null` means "storage not read yet", and it is load-bearing rather than
  // tidiness: starting at 'system' would let the effect below apply the system
  // theme on mount and wipe the class the head script had already set
  // correctly - a stored "dark" would render light until the next click.
  const [preference, setPreference] = useState<ThemePreference | null>(null)
  // Reading storage during render is what causes a hydration mismatch, so the
  // buttons show the default until the effect lands one tick later.
  const selected = preference ?? 'system'

  useEffect(() => {
    setPreference(normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY)))
  }, [])

  // Only while following the system: an explicit choice must not be overridden
  // when the machine flips theme at sunset.
  useEffect(() => {
    if (preference !== 'system') return
    const media = window.matchMedia(DARK_QUERY)
    const sync = () => applyResolvedTheme(resolveTheme('system', media.matches))
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [preference])

  function choose(next: ThemePreference) {
    setPreference(next)
    if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, next)
    applyResolvedTheme(resolveTheme(next, window.matchMedia(DARK_QUERY).matches))
  }

  return (
    <div
      role="radiogroup"
      aria-label="Chế độ hiển thị"
      className="flex items-center gap-0.5 rounded-lg border border-border bg-background/60 p-0.5"
    >
      {THEME_PREFERENCES.map((option) => {
        const Icon = ICONS[option]
        const active = selected === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            title={THEME_LABELS[option]}
            onClick={() => choose(option)}
            className={cn(
              'flex size-7 items-center justify-center rounded-md transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon aria-hidden className="size-4" />
            <span className="sr-only">{THEME_LABELS[option]}</span>
          </button>
        )
      })}
    </div>
  )
}
