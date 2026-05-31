import {
  PENDING_CANVAS_ID_KEY,
  PENDING_NEW_CANVAS_KEY,
} from './constants';

export const CANVAS_HOME_PATHS = ['/', '/home', '/canvas-home'];
export const CANVAS_EDITOR_PATH = '/editor';

export function normalizePathname(pathname = '') {
  const trimmed = String(pathname || '/').replace(/\/+$/, '');
  return trimmed || '/';
}

export function isCanvasHomePath(pathname) {
  return CANVAS_HOME_PATHS.includes(normalizePathname(pathname));
}

export function hasPendingCanvasIntent() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.localStorage.getItem(PENDING_CANVAS_ID_KEY) ||
      window.localStorage.getItem(PENDING_NEW_CANVAS_KEY)
  );
}

export function hasEditorSearchParams(search = '') {
  const params = new URLSearchParams(search || '');
  return Boolean(
    params.get('canvas') ||
      params.get('canvas_id') ||
      params.get('new') === '1' ||
      params.get('new') === 'true'
  );
}

export function shouldShowEditor(location = window.location) {
  const path = normalizePathname(location.pathname);
  if (path === CANVAS_EDITOR_PATH) return true;
  if (hasEditorSearchParams(location.search)) return true;
  if (hasPendingCanvasIntent()) return true;
  return false;
}

export function resolveInitialView(location = window.location) {
  return shouldShowEditor(location) ? 'editor' : 'home';
}
