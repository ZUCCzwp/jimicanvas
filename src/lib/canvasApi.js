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

/** @param {import('react').MutableRefObject<Record<string, number>>} versionsRef */
export function applyCanvasVersions(versionsRef, payload) {
  if (!versionsRef?.current || !payload) return;
  if (payload.canvas_versions && typeof payload.canvas_versions === 'object') {
    versionsRef.current = { ...versionsRef.current, ...payload.canvas_versions };
  }
}

/** 全部画布（组装列表，兼容旧逻辑） */
export async function fetchCanvasDocuments(token) {
  return requestCanvas('/api/canvas/documents', { token, method: 'GET' });
}

/** 画布元数据列表（不含节点详情） */
export async function fetchCanvasList(token) {
  return requestCanvas('/api/canvas/documents/list', { token, method: 'GET' });
}

/** 单个画布完整数据 */
export async function fetchCanvasDocument(token, canvasId) {
  return requestCanvas(`/api/canvas/documents/${encodeURIComponent(canvasId)}`, {
    token,
    method: 'GET',
  });
}

/** 保存单个画布 */
export async function saveCanvasDocument(
  token,
  canvasId,
  { document, version = 0, activeCanvasId }
) {
  return requestCanvas(`/api/canvas/documents/${encodeURIComponent(canvasId)}`, {
    token,
    method: 'PUT',
    body: {
      document,
      version: Number(version) || 0,
      ...(activeCanvasId ? { active_canvas_id: activeCanvasId } : {}),
    },
  });
}

/** 批量保存（首页重命名/复制/删除） */
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

export async function deleteCanvasDocument(token, canvasId) {
  return requestCanvas(`/api/canvas/documents/${encodeURIComponent(canvasId)}`, {
    token,
    method: 'DELETE',
  });
}

/** 页面关闭时用 keepalive 尽力上传当前画布 */
export function saveCanvasDocumentKeepalive(
  token,
  canvasId,
  { document, version = 0, activeCanvasId }
) {
  const authToken = token || getStoredChatToken();
  if (!authToken || !canvasId || typeof fetch === 'undefined') return;

  try {
    fetch(getApiUrl(`/api/canvas/documents/${encodeURIComponent(canvasId)}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
      },
      body: JSON.stringify({
        document,
        version: Number(version) || 0,
        ...(activeCanvasId ? { active_canvas_id: activeCanvasId } : {}),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/** @deprecated 使用 saveCanvasDocumentKeepalive */
export function saveCanvasDocumentsKeepalive(token, payload) {
  const docs = payload?.documents;
  const activeId = payload?.activeCanvasId || payload?.active_canvas_id;
  if (!Array.isArray(docs) || !activeId) return;
  const activeDoc = docs.find((doc) => doc?.id === activeId) || docs[0];
  if (!activeDoc) return;
  saveCanvasDocumentKeepalive(token, activeDoc.id, {
    document: activeDoc,
    version: payload?.canvasVersions?.[activeDoc.id] ?? payload?.version ?? 0,
    activeCanvasId: activeId,
  });
}
