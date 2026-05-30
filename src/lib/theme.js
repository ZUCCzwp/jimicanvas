export const THEME_STORAGE_KEY = 'jimicanvas.theme';

export const THEME_OPTIONS = ['dark', 'black', 'light'];

const THEME_CYCLE_LABELS = {
  dark: '纯黑',
  black: '浅色',
  light: '深色',
};

const listeners = new Set();

export function normalizeTheme(theme) {
  return THEME_OPTIONS.includes(theme) ? theme : 'dark';
}

export function getTheme() {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && THEME_OPTIONS.includes(stored)) return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const next = normalizeTheme(theme);
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = next === 'light' ? 'light' : 'dark';
  window.localStorage.setItem(THEME_STORAGE_KEY, next);
  listeners.forEach((listener) => listener(next));
  return next;
}

export function initTheme() {
  return applyTheme(getTheme());
}

export function setTheme(theme) {
  return applyTheme(theme);
}

export function getNextThemeLabel(theme = getTheme()) {
  const current = normalizeTheme(theme);
  const index = THEME_OPTIONS.indexOf(current);
  const next = THEME_OPTIONS[(index + 1) % THEME_OPTIONS.length];
  return THEME_CYCLE_LABELS[current] ?? next;
}

export function toggleTheme() {
  const current = getTheme();
  const index = THEME_OPTIONS.indexOf(current);
  const next = THEME_OPTIONS[(index + 1) % THEME_OPTIONS.length];
  return applyTheme(next);
}

export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
