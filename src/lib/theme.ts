import type { ProfileSettings } from '@/types/domain';

export type ThemePreference = ProfileSettings['theme'];
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'ledger:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_CHANGE_EVENT = 'ledger:theme-change';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function resolvedTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference;
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
    ? 'dark'
    : 'light';
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof window === 'undefined') return;

  const resolved = resolvedTheme(preference);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;

  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#050605' : '#176B5B');
  window.dispatchEvent(new CustomEvent<ResolvedTheme>(THEME_CHANGE_EVENT, { detail: resolved }));
}

export function setThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // The visual preference still applies when storage is unavailable.
  }
  applyThemePreference(preference);
}

export function startThemeSync(onChange?: (theme: ResolvedTheme) => void) {
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
  const refresh = () => applyThemePreference(getThemePreference());
  const syncFromStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) refresh();
  };
  const notify = (event: Event) => onChange?.((event as CustomEvent<ResolvedTheme>).detail);

  media?.addEventListener('change', refresh);
  window.addEventListener('storage', syncFromStorage);
  window.addEventListener(THEME_CHANGE_EVENT, notify);
  refresh();

  return () => {
    media?.removeEventListener('change', refresh);
    window.removeEventListener('storage', syncFromStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, notify);
  };
}

// App.tsx imports this module before React mounts, keeping the first painted frame
// aligned with the preference saved on this device.
if (typeof window !== 'undefined') applyThemePreference(getThemePreference());
