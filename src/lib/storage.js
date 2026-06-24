import { normalizeAudioUrl } from './audioApi';
import { normalizeCanvasBackground } from './canvasBackground';
import {
  ACTIVE_CANVAS_ID_KEY,
  PENDING_CANVAS_ID_KEY,
  PENDING_NEW_CANVAS_KEY,
  PENDING_WORKFLOW_TEMPLATE_KEY,
  STORAGE_KEY,
} from './constants';
import { normalizeImageUrl } from './imageApi';
import { normalizeVideoUrl } from './videoApi';

export const STORAGE_BACKUP_KEY = `${STORAGE_KEY}.backup`;

function readPendingStorage(key) {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(key);
  return value ? String(value).trim() : null;
}

export function readPendingCanvasId() {
  return readPendingStorage(PENDING_CANVAS_ID_KEY);
}

export function readPendingNewCanvas() {
  return readPendingStorage(PENDING_NEW_CANVAS_KEY) === '1';
}

export function setPendingCanvasId(canvasId) {
  if (typeof window === 'undefined' || !canvasId) return;
  window.localStorage.setItem(PENDING_CANVAS_ID_KEY, String(canvasId).trim());
  window.localStorage.removeItem(PENDING_NEW_CANVAS_KEY);
}

export function setPendingNewCanvas() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PENDING_NEW_CANVAS_KEY, '1');
  window.localStorage.removeItem(PENDING_CANVAS_ID_KEY);
  window.localStorage.removeItem(PENDING_WORKFLOW_TEMPLATE_KEY);
}

export function setPendingNewCanvasWithTemplate(templateId) {
  setPendingNewCanvas();
  if (typeof window === 'undefined' || !templateId) return;
  window.localStorage.setItem(PENDING_WORKFLOW_TEMPLATE_KEY, String(templateId).trim());
}

export function readPendingWorkflowTemplate() {
  return readPendingStorage(PENDING_WORKFLOW_TEMPLATE_KEY);
}

export function clearPendingCanvasIntent() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PENDING_CANVAS_ID_KEY);
  window.localStorage.removeItem(PENDING_NEW_CANVAS_KEY);
  window.localStorage.removeItem(PENDING_WORKFLOW_TEMPLATE_KEY);
}

export function readActiveCanvasId() {
  return readPendingStorage(ACTIVE_CANVAS_ID_KEY);
}

export function writeActiveCanvasId(canvasId) {
  if (typeof window === 'undefined' || !canvasId) return;
  window.localStorage.setItem(ACTIVE_CANVAS_ID_KEY, String(canvasId).trim());
}

export function normalizeDocuments(raw) {
  if (!Array.isArray(raw)) return null;

  const documents = raw
    .filter((doc) => doc && typeof doc === 'object' && doc.id)
    .map((doc) => ({
      id: String(doc.id),
      name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : '未命名画布',
      nodes: Array.isArray(doc.nodes) ? doc.nodes : [],
      connections: Array.isArray(doc.connections) ? doc.connections : [],
      background: normalizeCanvasBackground(doc.background),
      createdAt: Number(doc.createdAt) || Date.now(),
      updatedAt: Number(doc.updatedAt) || Date.now(),
    }));

  return documents.length > 0 ? documents : null;
}

function readDocumentsFromKey(key) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return normalizeDocuments(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readStorage() {
  return readDocumentsFromKey(STORAGE_KEY);
}

export function hasStorageBackup() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem(STORAGE_BACKUP_KEY));
}

export function readStorageBackup() {
  return readDocumentsFromKey(STORAGE_BACKUP_KEY);
}

export function documentsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function isBackupDifferentFrom(documents) {
  const backup = readStorageBackup();
  if (!backup || backup.length === 0) return false;
  return !documentsEqual(backup, documents);
}

export function promoteBackupToPrimary(backup) {
  if (typeof window === 'undefined' || !Array.isArray(backup) || backup.length === 0) {
    return { ok: false };
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(backup));
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败';
    return { ok: false, error: message };
  }
}

function isPersistableUrl(value) {
  const str = String(value || '').trim();
  if (!str) return false;
  if (str.startsWith('data:') || str.startsWith('blob:')) return false;
  return true;
}

function sanitizeMediaUrl(value, normalizer) {
  if (!isPersistableUrl(value)) return '';
  return normalizer(value);
}

function sanitizeReferenceAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const mediaType = asset.type || 'image';
  const candidate = asset.uploadedUrl || asset.url || asset.path || '';
  const url =
    mediaType === 'audio'
      ? sanitizeMediaUrl(candidate, normalizeAudioUrl)
      : mediaType === 'video'
        ? sanitizeMediaUrl(candidate, normalizeVideoUrl)
        : sanitizeMediaUrl(candidate, normalizeImageUrl);
  if (!url) return null;
  return {
    id: asset.id,
    name: asset.name,
    url,
    source: asset.source || 'remote',
    type: mediaType,
  };
}

function stripLocalMediaValue(value, fallback = '') {
  const str = String(value || '').trim();
  if (!str) return fallback;
  if (str.startsWith('data:') || str.startsWith('blob:')) return fallback;
  return str;
}

function sanitizeNode(node) {
  if (!node || typeof node !== 'object') return node;
  const next = { ...node };

  if (Array.isArray(next.referenceImages)) {
    next.referenceImages = next.referenceImages.map(sanitizeReferenceAsset).filter(Boolean);
  }
  if (Array.isArray(next.videoReferenceVideos)) {
    next.videoReferenceVideos = next.videoReferenceVideos.map(sanitizeReferenceAsset).filter(Boolean);
  }
  if (Array.isArray(next.videoReferenceAudios)) {
    next.videoReferenceAudios = next.videoReferenceAudios.map(sanitizeReferenceAsset).filter(Boolean);
  }
  if (next.videoFirstFrame) {
    next.videoFirstFrame = sanitizeReferenceAsset(next.videoFirstFrame);
  }
  if (next.videoLastFrame) {
    next.videoLastFrame = sanitizeReferenceAsset(next.videoLastFrame);
  }

  if (next.type === 'image') {
    if (Array.isArray(next.images)) {
      next.images = next.images
        .map((url) => sanitizeMediaUrl(url, normalizeImageUrl))
        .filter(Boolean);
    }
    if (next.content) {
      const contentUrl = sanitizeMediaUrl(next.content, normalizeImageUrl);
      next.content = contentUrl || stripLocalMediaValue(next.content, next.images?.[0] || '');
    }
  }

  if (next.type === 'video') {
    if (Array.isArray(next.videos)) {
      next.videos = next.videos
        .map((url) => sanitizeMediaUrl(url, normalizeVideoUrl))
        .filter(Boolean);
    }
    if (next.content) {
      const contentUrl = sanitizeMediaUrl(next.content, normalizeVideoUrl);
      next.content = contentUrl || stripLocalMediaValue(next.content, next.videos?.[0] || '');
    }
  }

  if (next.type === 'audio') {
    if (next.audioUrl) {
      next.audioUrl = sanitizeMediaUrl(next.audioUrl, normalizeAudioUrl);
    }
    if (next.content) {
      const contentUrl = sanitizeMediaUrl(next.content, normalizeAudioUrl);
      next.content = contentUrl || stripLocalMediaValue(next.content, next.audioUrl || '');
    }
  }

  return next;
}

export function sanitizeDocumentsForPersist(documents) {
  if (!Array.isArray(documents)) return documents;
  return documents.map((doc) => ({
    ...doc,
    nodes: Array.isArray(doc.nodes) ? doc.nodes.map(sanitizeNode) : [],
  }));
}

export function writeStorage(documents) {
  if (typeof window === 'undefined') {
    return { ok: true };
  }

  try {
    const next = JSON.stringify(sanitizeDocumentsForPersist(documents));
    const existing = window.localStorage.getItem(STORAGE_KEY);
    
    if (existing) {
      try {
        window.localStorage.setItem(STORAGE_BACKUP_KEY, existing);
      } catch (backupError) {
        console.warn('[storage] Failed to write backup storage:', backupError);
        try {
          window.localStorage.removeItem(STORAGE_BACKUP_KEY);
        } catch (_) {}
      }
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (primaryError) {
      console.warn('[storage] Failed to write primary storage, retrying without backup:', primaryError);
      try {
        window.localStorage.removeItem(STORAGE_BACKUP_KEY);
      } catch (_) {}
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败';
    return { ok: false, error: message };
  }
}

function resolveActiveCanvasId(documents, { pendingId, storedActiveId } = {}) {
  if (!documents?.length) return pendingId || storedActiveId || null;
  if (pendingId && documents.some((doc) => doc.id === pendingId)) return pendingId;
  if (storedActiveId && documents.some((doc) => doc.id === storedActiveId)) return storedActiveId;
  return documents[0].id;
}

/** 启动时优先读本地缓存，云端 hydrate 后再合并 */
export function loadInitialState() {
  const pendingId = readPendingCanvasId();
  const storedActiveId = readActiveCanvasId();

  const primary = readDocumentsFromKey(STORAGE_KEY);
  if (primary?.length) {
    const activeCanvasId = resolveActiveCanvasId(primary, { pendingId, storedActiveId });
    return {
      documents: sanitizeDocumentsForPersist(primary),
      activeCanvasId,
      loadedFrom: 'primary',
    };
  }

  const backup = readDocumentsFromKey(STORAGE_BACKUP_KEY);
  if (backup?.length) {
    promoteBackupToPrimary(backup);
    const activeCanvasId = resolveActiveCanvasId(backup, { pendingId, storedActiveId });
    return {
      documents: sanitizeDocumentsForPersist(backup),
      activeCanvasId,
      loadedFrom: 'backup',
    };
  }

  return {
    documents: [],
    activeCanvasId: pendingId,
    loadedFrom: 'empty',
  };
}
