import { getStoredChatToken, syncStoredChatToken } from './jimiaigoApi';
import {
  setPendingCanvasId,
  setPendingNewCanvas,
} from './storage';
import { CANVAS_EDITOR_PATH } from './routing';

export function getJimiaiAppBaseUrl() {
  const webApp = import.meta.env.VITE_WEB_APP_URL || import.meta.env.VITE_JIMIAIAPP_URL;
  if (webApp) return String(webApp).replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:9527';
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

function isCrossOriginCanvasTarget(baseUrl) {
  if (!baseUrl || typeof window === 'undefined') return false;
  try {
    return new URL(baseUrl).origin !== window.location.origin;
  } catch {
    return true;
  }
}

export function buildCanvasHomeUrl() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.origin}/`;
}

export function navigateToCanvasHome() {
  window.location.href = buildCanvasHomeUrl();
}

/** 同域跳转：意图写入 localStorage，避免 URL 暴露 token */
export function buildCanvasEditorUrl({ canvasId, createNew, crossOriginBase } = {}) {
  const base =
    crossOriginBase ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL(`${base}${CANVAS_EDITOR_PATH}`);

  if (isCrossOriginCanvasTarget(base)) {
    const token = getStoredChatToken();
    if (token) url.searchParams.set('at', token);
    if (createNew) {
      url.searchParams.set('new', '1');
    } else if (canvasId) {
      url.searchParams.set('canvas', canvasId);
    }
  }

  return url.toString();
}

export function openCanvasEditor({ canvasId, createNew } = {}) {
  if (typeof window === 'undefined') return;

  const token = getStoredChatToken();
  if (token) syncStoredChatToken(token);

  if (createNew) {
    setPendingNewCanvas();
  } else if (canvasId) {
    setPendingCanvasId(canvasId);
  }

  window.location.href = buildCanvasEditorUrl({ canvasId, createNew });
}

/** @deprecated Use openCanvasEditor */
export function openCanvasApp(options = {}) {
  openCanvasEditor(options);
}
