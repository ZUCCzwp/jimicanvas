import { getChatApiBaseUrl, getStoredChatToken } from './chatApi';
import { normalizeDocuments } from './storage';

async function requestCanvas(path, { token, method = 'GET', body } = {}) {
  const authToken = token || getStoredChatToken();
  if (!authToken) {
    throw new Error('未登录，无法同步画布');
  }

  const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('请求失败，无法连接到画布服务');
    }
    throw error;
  }

  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || (parsed && parsed.code && parsed.code !== 20000)) {
    const err = new Error(parsed?.msg || parsed?.message || rawText || '画布同步失败');
    if (parsed?.data) {
      err.latest = parsed.data;
      err.isConflict = /其他端|刷新/.test(String(parsed?.msg || ''));
    }
    throw err;
  }

  return parsed?.data ?? parsed;
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

  const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');
  try {
    fetch(`${baseUrl}/api/canvas/documents`, {
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
