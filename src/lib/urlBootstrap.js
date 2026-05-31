import { PENDING_CANVAS_ID_KEY, PENDING_NEW_CANVAS_KEY } from './constants';
import { syncStoredChatToken } from './jimiaigoApi';

/**
 * 解析 URL 中的 at / canvas / new，写入 storage 后从地址栏移除。
 */
export function bootstrapFromUrl() {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  let changed = false;

  const rawToken = params.get('at') || params.get('token');
  if (rawToken) {
    const token = String(rawToken).trim();
    if (token) {
      syncStoredChatToken(token);
    }
    params.delete('at');
    params.delete('token');
    changed = true;
  }

  const canvasId = params.get('canvas') || params.get('canvas_id');
  if (canvasId) {
    const id = String(canvasId).trim();
    if (id) {
      window.localStorage.setItem(PENDING_CANVAS_ID_KEY, id);
      window.localStorage.removeItem(PENDING_NEW_CANVAS_KEY);
    }
    params.delete('canvas');
    params.delete('canvas_id');
    changed = true;
  }

  const newFlag = params.get('new');
  if (newFlag === '1' || newFlag === 'true') {
    window.localStorage.setItem(PENDING_NEW_CANVAS_KEY, '1');
    window.localStorage.removeItem(PENDING_CANVAS_ID_KEY);
    params.delete('new');
    changed = true;
  }

  if (!changed) return;

  const search = params.toString();
  const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', nextUrl);
}
