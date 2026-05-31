import { normalizeCanvasBackground } from './canvasBackground';
import { PENDING_CANVAS_ID_KEY } from './constants';
import { normalizeImageUrl } from './imageApi';
import { normalizeVideoUrl } from './videoApi';

/** 清除旧版本地画布缓存（仅迁移用，画布数据现只存云端） */
export function clearLegacyCanvasCache() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('jimicanvas.documents.v1');
  window.localStorage.removeItem('jimicanvas.documents.v1.backup');
  window.localStorage.removeItem('jimicanvas.cloud.version');
}

function readPendingCanvasId() {
  if (typeof window === 'undefined') return null;
  const id = window.sessionStorage.getItem(PENDING_CANVAS_ID_KEY);
  return id ? String(id).trim() : null;
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
      next.content = contentUrl || next.content;
      if (String(next.content).startsWith('data:')) {
        next.content = next.images?.[0] || '';
      }
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
      next.content = contentUrl || next.content;
    }
  }

  if (next.type === 'audio' && next.audioUrl) {
    next.audioUrl = sanitizeMediaUrl(next.audioUrl, normalizeAudioUrl);
    if (next.content) {
      next.content = sanitizeMediaUrl(next.content, normalizeAudioUrl) || next.content;
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

/** 启动时不读 localStorage，等待云端 hydrate */
export function loadInitialState() {
  return {
    documents: [],
    activeCanvasId: readPendingCanvasId(),
  };
}
