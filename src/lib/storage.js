import { STORAGE_KEY } from './constants';
import { createDocument } from './canvas';

export function readStorage() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStorage(documents) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  } catch {
    // ignore quota / privacy mode issues
  }
}

export function loadInitialState() {
  const stored = readStorage();
  if (stored && stored.length > 0) {
    return {
      documents: stored,
      activeCanvasId: stored[0].id,
    };
  }

  const first = createDocument('画布 1');
  return {
    documents: [first],
    activeCanvasId: first.id,
  };
}
