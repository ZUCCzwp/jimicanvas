import { getApiUrl, getStoredChatToken, requestJimiaigo } from './jimiaigoApi';
import { normalizeDocuments } from './storage';

async function requestCanvas(path, { token, method = 'GET', body } = {}) {
  const authToken = token || getStoredChatToken();
  if (!authToken) {
    throw new Error('未登录，无法同步画布');
  }

  return requestJimiaigo(path, {
    token: authToken,
    method,
    body,
    fallback: '画布同步失败',
    networkErrorMessage: '请求失败，无法连接到画布服务',
    enrichError(err, parsed) {
      if (parsed?.data) {
        err.latest = parsed.data;
        err.isConflict = /其他端|刷新/.test(String(parsed?.msg || ''));
      }
    },
  });
}

export function parseCloudDocuments(documentsField) {
  if (!documentsField) return null;
  if (Array.isArray(documentsField)) {
    return normalizeDocuments(documentsField);
  }
  if (typeof documentsField === 'string') {
    try {
      return normalizeDocuments(JSON.parse(documentsField));
    } catch {
      return null;
    }
  }
  return null;
}

export async function fetchCanvasDocuments(token) {
  return requestCanvas('/api/canvas/documents', { token, method: 'GET' });
}

export async function saveCanvasDocuments(token, { documents, activeCanvasId, version = 0 }) {
  return requestCanvas('/api/canvas/documents', {
    token,
    method: 'PUT',
    body: {
      documents,
      active_canvas_id: activeCanvasId || '',
      version: Number(version) || 0,
    },
  });
}

/** 页面关闭时用 keepalive 尽力上传，避免刷新时尚未触发防抖保存 */
export function saveCanvasDocumentsKeepalive(token, { documents, activeCanvasId, version = 0 }) {
  const authToken = token || getStoredChatToken();
  if (!authToken || typeof fetch === 'undefined') return;

  try {
    fetch(getApiUrl('/api/canvas/documents'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
      },
      body: JSON.stringify({
        documents,
        active_canvas_id: activeCanvasId || '',
        version: Number(version) || 0,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}
