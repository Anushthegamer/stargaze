/**
 * Theme: light, dark, or follow the OS.
 *
 * This only ever governs the chrome -- sheets, settings, onboarding, lists.
 * The sky canvas, and the HUD/card that sit directly over it while you're
 * actually looking at it, are locked to night colours in styles.css
 * regardless of this setting (see the ".hud, .card, .toast" rule there) --
 * a bright screen at either end kills the dark adaptation this app exists
 * to protect.
 *
 * The initial value is applied synchronously in index.html, before this
 * module loads, so there is no flash of the wrong theme on cold start. This
 * module handles everything after that: persisting a change, and following
 * the OS if the preference is "system".
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'stargaze.theme';

/** The browser's own chrome tint (address bar / status bar), kept in step
 *  with the resolved theme. Matches --night-bg and the light --bg token. */
const CHROME_COLOR: Record<ResolvedTheme, string> = {
  dark: '#05070d',
  light: '#f1ece0',
};

export function loadThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* not worth telling the user about */
  }
}

function prefersDark(): boolean {
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference;
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME_COLOR[resolved]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', resolved);
}

/** Re-applies whenever the OS scheme flips while the app is open -- but only
 *  while "system" is the active choice, so an explicit light/dark pick is
 *  never disturbed by the OS changing under it. */
export function watchSystemTheme(getPreference: () => ThemePreference): void {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getPreference() === 'system') applyTheme('system');
  });
}
