import { getStoredChatToken } from './jimiaigoApi';
import { CANVAS_EDITOR_PATH } from './routing';

export function getJimiaiAppBaseUrl() {
  const webApp = import.meta.env.VITE_WEB_APP_URL || import.meta.env.VITE_JIMIAIAPP_URL;
  if (webApp) return String(webApp).replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:9527';
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function buildCanvasHomeUrl() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.origin}/`;
}

export function navigateToCanvasHome() {
  window.location.href = buildCanvasHomeUrl();
}

export function buildCanvasEditorUrl({ canvasId, createNew } = {}) {
  const url = new URL(`${window.location.origin}${CANVAS_EDITOR_PATH}`);
  const token = getStoredChatToken();
  if (token) url.searchParams.set('at', token);
  if (createNew) {
    url.searchParams.set('new', '1');
  } else if (canvasId) {
    url.searchParams.set('canvas', canvasId);
  }
  return url.toString();
}

export function openCanvasEditor({ canvasId, createNew } = {}) {
  window.location.href = buildCanvasEditorUrl({ canvasId, createNew });
}

/** @deprecated Use openCanvasEditor */
export function openCanvasApp(options = {}) {
  openCanvasEditor(options);
}
