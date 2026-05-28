export const THEME_STORAGE_KEY = 'jimicanvas.theme';

const listeners = new Set();

export function getTheme() {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = next;
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

export function toggleTheme() {
  return applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
