import { STORAGE_KEY } from './constants';
import { createDocument } from './canvas';

export const STORAGE_BACKUP_KEY = `${STORAGE_KEY}.backup`;

export function normalizeDocuments(raw) {
  if (!Array.isArray(raw)) return null;

  const documents = raw
    .filter((doc) => doc && typeof doc === 'object' && doc.id)
    .map((doc) => ({
      id: String(doc.id),
      name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : '未命名画布',
      nodes: Array.isArray(doc.nodes) ? doc.nodes : [],
      connections: Array.isArray(doc.connections) ? doc.connections : [],
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

/** 启动时从备份恢复主存储，避免 writeStorage 用损坏的主数据覆盖备份 */
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

export function writeStorage(documents) {
  if (typeof window === 'undefined') {
    return { ok: true };
  }

  try {
    const next = JSON.stringify(documents);
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) {
      window.localStorage.setItem(STORAGE_BACKUP_KEY, existing);
    }
    window.localStorage.setItem(STORAGE_KEY, next);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败';
    return { ok: false, error: message };
  }
}

export function loadInitialState() {
  const primary = readDocumentsFromKey(STORAGE_KEY);
  if (primary && primary.length > 0) {
    return {
      documents: primary,
      activeCanvasId: primary[0].id,
      loadedFrom: 'primary',
    };
  }

  const backup = readDocumentsFromKey(STORAGE_BACKUP_KEY);
  if (backup && backup.length > 0) {
    promoteBackupToPrimary(backup);
    return {
      documents: backup,
      activeCanvasId: backup[0].id,
      loadedFrom: 'backup',
    };
  }

  const first = createDocument('画布 1');
  return {
    documents: [first],
    activeCanvasId: first.id,
    loadedFrom: 'default',
  };
}
