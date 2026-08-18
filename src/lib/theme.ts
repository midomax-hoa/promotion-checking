/**
 * Theme preference, shared by the anti-flash script and the toggle.
 *
 * Three states rather than two: an operator projecting the screen for someone
 * else needs to force light or dark regardless of what the machine prefers, and
 * "follow the system" has to stay reachable after they do.
 */

export const THEME_STORAGE_KEY = 'promotion-checking:theme'

export type ThemePreference = 'system' | 'light' | 'dark'

/** Order the toggle renders them in: the default first. */
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark']

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Theo hệ thống',
  light: 'Sáng',
  dark: 'Tối',
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** Anything unrecognised in storage falls back to following the system. */
export function normalizeThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (preference === 'system') return prefersDark ? 'dark' : 'light'
  return preference
}

/**
 * The single place that writes the class, so the script and the toggle can
 * never disagree about how a resolved theme is expressed in the DOM.
 * `colorScheme` is set alongside it so scrollbars and native form controls
 * follow rather than staying stubbornly light.
 */
export function applyResolvedTheme(resolved: 'light' | 'dark'): void {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}
