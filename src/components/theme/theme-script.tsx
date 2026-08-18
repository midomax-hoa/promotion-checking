/**
 * Sets the theme class before the browser paints.
 *
 * Doing this in an effect would mean the page renders light, then flips - a
 * white flash on every navigation for anyone using dark mode. The script has to
 * be synchronous and it has to be in <head>, which is the whole reason it is a
 * raw string instead of a component with state.
 */

import { THEME_STORAGE_KEY } from '@/lib/theme'

/**
 * Built from the shared key so the script and `theme.ts` cannot drift apart.
 * The value interpolated is a module constant, never user input, so there is
 * nothing here for an attacker to reach.
 */
const SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
}
