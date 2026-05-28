import { getStoredChatToken } from './jimiaigoApi';

export function getJimiaiAppBaseUrl() {
  const webApp = import.meta.env.VITE_WEB_APP_URL || import.meta.env.VITE_JIMIAIAPP_URL;
  if (webApp) return String(webApp).replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:9527';
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function buildCanvasHomeUrl() {
  const base = getJimiaiAppBaseUrl();
  if (!base) return '/canvas-home';

  const url = new URL(`${base}/canvas-home`);
  const token = getStoredChatToken();
  if (token) url.searchParams.set('at', token);
  return url.toString();
}

export function navigateToCanvasHome() {
  window.location.href = buildCanvasHomeUrl();
}
