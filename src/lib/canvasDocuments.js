import { normalizeCanvasBackground } from './canvasBackground';
import { DEFAULT_CANVAS_BACKGROUND } from './constants';

function createCanvasUid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseRawDocuments(documentsField) {
  let raw = documentsField;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((doc) => doc && doc.id)
    .map((doc) => normalizeDocument(doc));
}

export function normalizeDocument(doc) {
  const now = Date.now();
  return {
    id: String(doc.id),
    name: typeof doc.name === 'string' && doc.name.trim() ? doc.name.trim() : '未命名画布',
    nodes: Array.isArray(doc.nodes) ? doc.nodes : [],
    connections: Array.isArray(doc.connections) ? doc.connections : [],
    background: normalizeCanvasBackground(doc.background),
    createdAt: Number(doc.createdAt) || now,
    updatedAt: Number(doc.updatedAt) || now,
  };
}

export function documentsToProjects(documents) {
  return [...documents]
    .map((doc) => ({
      id: doc.id,
      name: doc.name,
      updatedAt: doc.updatedAt,
      nodeCount: doc.nodes.length,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function createEmptyDocument(name = '画布 1') {
  const now = Date.now();
  return {
    id: createCanvasUid('canvas'),
    name,
    nodes: [],
    connections: [],
    background: DEFAULT_CANVAS_BACKGROUND,
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateDocument(source) {
  const now = Date.now();
  const idMap = new Map();
  const cloned = JSON.parse(JSON.stringify(source));

  cloned.id = createCanvasUid('canvas');
  const baseName = (source.name || '未命名画布').replace(/\s+副本(\s*\d+)?$/, '');
  cloned.name = `${baseName} 副本`;
  cloned.createdAt = now;
  cloned.updatedAt = now;

  if (Array.isArray(cloned.nodes)) {
    cloned.nodes = cloned.nodes.map((node) => {
      const next = { ...node, id: createCanvasUid('node') };
      idMap.set(node.id, next.id);
      if (next.status === 'running') next.status = 'idle';
      delete next.imageTaskId;
      delete next.videoTaskId;
      delete next.pendingTasks;
      delete next.generationJob;
      delete next.generationBatch;
      return next;
    });
  } else {
    cloned.nodes = [];
  }

  if (Array.isArray(cloned.connections)) {
    cloned.connections = cloned.connections
      .map((link) => ({
        ...link,
        id: createCanvasUid('link'),
        fromNodeId: idMap.get(link.fromNodeId) || link.fromNodeId,
        toNodeId: idMap.get(link.toNodeId) || link.toNodeId,
      }))
      .filter((link) => link.fromNodeId && link.toNodeId);
  } else {
    cloned.connections = [];
  }

  return cloned;
}

export function renameDocument(documents, documentId, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return documents;

  const now = Date.now();
  return documents.map((doc) =>
    doc.id === documentId ? { ...doc, name: trimmed, updatedAt: now } : doc
  );
}

export function deleteDocument(documents, activeCanvasId, documentId) {
  if (documents.length <= 1) {
    const replacement = createEmptyDocument('画布 1');
    return {
      documents: [replacement],
      activeCanvasId: replacement.id,
    };
  }

  const now = Date.now();
  const nextDocuments = documents
    .filter((doc) => doc.id !== documentId)
    .map((doc) => ({ ...doc, updatedAt: now }));
  const nextActive =
    activeCanvasId === documentId ? nextDocuments[0]?.id || '' : activeCanvasId;

  return {
    documents: nextDocuments,
    activeCanvasId: nextActive,
  };
}
