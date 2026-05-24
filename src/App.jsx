import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileUp,
  Image as ImageIcon,
  Film,
  Link2,
  PencilLine,
  Plus,
  Play,
  LoaderCircle,
  ZoomIn,
  ZoomOut,
  SquarePen,
  Trash2,
  RotateCcw,
  Wand2,
  FileText,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'jimicanvas.documents.v1';
const JIMIAIGO_TOKEN_STORAGE_KEY = 'jimicanvas.jimiaigo.token';
const DEFAULT_CHAT_API_URL = 'http://localhost:27355';
const DEFAULT_NODE_WIDTH = 260;
const DEFAULT_NODE_HEIGHT = 180;
const MIN_CANVAS_SCALE = 0.6;
const MAX_CANVAS_SCALE = 1.4;
const CANVAS_SCALE_STEP = 0.1;
const DEFAULT_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" rx="24" fill="url(#g)"/>
    <rect x="44" y="44" width="552" height="272" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)"/>
    <circle cx="204" cy="156" r="32" fill="#38bdf8"/>
    <path d="M118 268L244 160L332 236L418 188L538 268" fill="none" stroke="#e0f2fe" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="320" y="312" text-anchor="middle" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="24">Canvas image node</text>
  </svg>
`)}`;

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNode(type, x, y) {
  const id = uid('node');
  if (type === 'image') {
    return {
      id,
      type,
      title: '图片节点',
      content: PLACEHOLDER_IMAGE,
      x,
      y,
      width: 320,
      height: 240,
    };
  }

  if (type === 'video') {
    return {
      id,
      type,
      title: '视频节点',
      content: DEFAULT_VIDEO_URL,
      x,
      y,
      width: 340,
      height: 260,
    };
  }

  return {
    id,
    type: 'note',
    title: '文本节点',
    content: '在这里输入内容，拖动标题栏可以移动节点。右侧圆点发起连线。',
    x,
    y,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
  };
}

function createDocument(name, withStarterNodes = true) {
  const now = Date.now();
  const nodes = withStarterNodes
    ? [
        {
          id: uid('node'),
          type: 'note',
          title: '欢迎使用',
          content: '这是一个轻量画布。左侧创建画布，中间拖拽节点，点击圆点连线。',
          x: 120,
          y: 100,
          width: DEFAULT_NODE_WIDTH,
          height: DEFAULT_NODE_HEIGHT,
        },
        {
          id: uid('node'),
          type: 'image',
          title: '示例图片',
          content: PLACEHOLDER_IMAGE,
          x: 520,
          y: 210,
          width: 320,
          height: 240,
        },
      ]
    : [];

  const connections = withStarterNodes
    ? [
        {
          id: uid('link'),
          fromNodeId: nodes[0].id,
          toNodeId: nodes[1].id,
        },
      ]
    : [];

  return {
    id: uid('canvas'),
    name,
    nodes,
    connections,
    createdAt: now,
    updatedAt: now,
  };
}

function readStorage() {
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

function writeStorage(documents) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  } catch {
    // ignore quota / privacy mode issues
  }
}

function loadInitialState() {
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

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snapScale(value) {
  return Math.round(value * 10) / 10;
}

function getConnectionPath(source, target) {
  const x1 = source.x + source.width;
  const y1 = source.y + source.height / 2;
  const x2 = target.x;
  const y2 = target.y + target.height / 2;
  const bend = Math.max(80, Math.abs(x2 - x1) * 0.35);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

function isImageContent(content) {
  return typeof content === 'string' && (content.startsWith('data:image') || /^https?:\/\//.test(content));
}

function isVideoContent(content) {
  return typeof content === 'string' && (content.startsWith('data:video') || /^https?:\/\//.test(content));
}

function getChatApiBaseUrl() {
  if (typeof import.meta !== 'undefined') {
    return import.meta.env.VITE_API_URL || import.meta.env.VITE_JIMIAIGO_API_URL || DEFAULT_CHAT_API_URL;
  }
  return DEFAULT_CHAT_API_URL;
}

function getStoredChatToken() {
  if (typeof window === 'undefined') return '';

  const envToken = import.meta.env.VITE_API_TOKEN || import.meta.env.VITE_JIMIAIGO_TOKEN;
  if (envToken) return String(envToken).trim();

  return (
    window.localStorage.getItem(JIMIAIGO_TOKEN_STORAGE_KEY) ||
    window.localStorage.getItem('token') ||
    window.localStorage.getItem('access_token') ||
    ''
  ).trim();
}

function App() {
  const initial = useMemo(() => loadInitialState(), []);
  const [documents, setDocuments] = useState(initial.documents);
  const [activeCanvasId, setActiveCanvasId] = useState(initial.activeCanvasId);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [linkFromNodeId, setLinkFromNodeId] = useState(null);
  const [hoverLinkNodeId, setHoverLinkNodeId] = useState(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [importError, setImportError] = useState('');
  const [runningNodeId, setRunningNodeId] = useState(null);
  const [showCanvasPanel, setShowCanvasPanel] = useState(false);

  const stageRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    writeStorage(documents);
  }, [documents]);

  useEffect(() => {
    if (!documents.some((doc) => doc.id === activeCanvasId)) {
      setActiveCanvasId(documents[0]?.id || null);
      setSelectedNodeId(null);
      setSelectedConnectionId(null);
      setEditingNodeId(null);
      setHoverLinkNodeId(null);
    }
  }, [documents, activeCanvasId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (isEditableTarget) return;

      if (event.key === 'Escape') {
        setLinkFromNodeId(null);
        setHoverLinkNodeId(null);
        setEditingNodeId(null);
        setSelectedConnectionId(null);
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedConnectionId) {
        event.preventDefault();
        removeConnection(selectedConnectionId);
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId) {
        event.preventDefault();
        removeNode(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConnectionId, selectedNodeId]);

  const activeCanvas = documents.find((doc) => doc.id === activeCanvasId) || documents[0];
  const nodes = activeCanvas?.nodes || [];
  const connections = activeCanvas?.connections || [];
  const canvasScalePercent = Math.round(canvasScale * 100);
  const toastError = importError;

  function setCanvasScaleClamped(nextScale) {
    setCanvasScale(snapScale(clampValue(nextScale, MIN_CANVAS_SCALE, MAX_CANVAS_SCALE)));
  }

  function zoomCanvas(delta) {
    setCanvasScaleClamped(canvasScale + delta);
  }

  function resetCanvasScale() {
    setCanvasScale(1);
  }

  function getStagePoint(event) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: (event.clientX - rect.left) / canvasScale,
      y: (event.clientY - rect.top) / canvasScale,
    };
  }

  function updateActiveCanvas(updater) {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id !== activeCanvasId) return doc;
        const next = updater(doc);
        return { ...next, updatedAt: Date.now() };
      })
    );
  }

  function createCanvas() {
    const count = documents.length + 1;
    const canvas = createDocument(`画布 ${count}`, false);
    setDocuments((prev) => [canvas, ...prev]);
    setActiveCanvasId(canvas.id);
    setSelectedNodeId(null);
    setSelectedConnectionId(null);
    setEditingNodeId(null);
    setLinkFromNodeId(null);
    setHoverLinkNodeId(null);
  }

  function renameCanvas(name) {
    updateActiveCanvas((doc) => ({ ...doc, name }));
  }

  function deleteCanvas(canvasId) {
    if (documents.length === 1) {
      const replacement = createDocument('画布 1', false);
      setDocuments([replacement]);
      setActiveCanvasId(replacement.id);
      setSelectedNodeId(null);
      setSelectedConnectionId(null);
      setEditingNodeId(null);
      setLinkFromNodeId(null);
      setHoverLinkNodeId(null);
      return;
    }

    const next = documents.filter((doc) => doc.id !== canvasId);
    setDocuments(next);
    if (canvasId === activeCanvasId) {
      setActiveCanvasId(next[0]?.id || null);
      setSelectedNodeId(null);
      setSelectedConnectionId(null);
      setEditingNodeId(null);
      setLinkFromNodeId(null);
      setHoverLinkNodeId(null);
    }
  }

  function addNode(type) {
    const rect = stageRef.current?.getBoundingClientRect();
    const centerX = rect ? rect.width / 2 - DEFAULT_NODE_WIDTH / 2 : 220;
    const centerY = rect ? rect.height / 2 - DEFAULT_NODE_HEIGHT / 2 : 160;
    const node = createNode(type, centerX + Math.random() * 80 - 40, centerY + Math.random() * 80 - 40);

    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: [...doc.nodes, node],
    }));
    setSelectedNodeId(node.id);
    setSelectedConnectionId(null);
    setEditingNodeId(null);
  }

  function updateNode(nodeId, patch) {
    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    }));
  }

  function removeNode(nodeId) {
    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.filter((node) => node.id !== nodeId),
      connections: doc.connections.filter(
        (link) => link.fromNodeId !== nodeId && link.toNodeId !== nodeId
      ),
    }));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    if (editingNodeId === nodeId) {
      setEditingNodeId(null);
    }
    if (selectedConnectionId) {
      const selectedLink = connections.find((link) => link.id === selectedConnectionId);
      if (selectedLink && (selectedLink.fromNodeId === nodeId || selectedLink.toNodeId === nodeId)) {
        setSelectedConnectionId(null);
      }
    }
    if (linkFromNodeId === nodeId) {
      setLinkFromNodeId(null);
      setHoverLinkNodeId(null);
    }
  }

  function removeConnection(connectionId) {
    updateActiveCanvas((doc) => ({
      ...doc,
      connections: doc.connections.filter((link) => link.id !== connectionId),
    }));
    if (selectedConnectionId === connectionId) {
      setSelectedConnectionId(null);
    }
  }

  async function runTextGeneration(node) {
    const promptText = String(node.content || node.title || '').trim();
    if (!promptText) {
      updateNode(node.id, { content: '文本节点内容为空', status: 'error' });
      return;
    }

    let token = getStoredChatToken();
    if (!token && typeof window !== 'undefined') {
      const input = window.prompt('请输入 Jimiaigo 的 token');
      if (input) {
        token = String(input).trim();
        window.localStorage.setItem(JIMIAIGO_TOKEN_STORAGE_KEY, token);
      }
    }

    if (!token) {
      updateNode(node.id, { content: '缺少 token', status: 'error' });
      return;
    }

    const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');

    setRunningNodeId(node.id);

    try {
      const response = await fetch(`${baseUrl}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
        },
        body: JSON.stringify({
          model: 'gpt-5.4-mini',
          stream: false,
          messages: [{ role: 'user', content: promptText }],
        }),
      });

      const rawText = await response.text();
      let parsed = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        throw new Error(parsed?.msg || parsed?.message || rawText || '生成失败');
      }

      const generated = parsed?.choices?.[0]?.message?.content;
      if (typeof generated !== 'string' || !generated.trim()) {
        throw new Error('返回内容为空');
      }

      updateNode(node.id, { content: generated.trim(), status: 'idle' });
      setSelectedNodeId(node.id);
      setEditingNodeId(node.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      updateNode(node.id, { content: message, status: 'error' });
      setSelectedNodeId(node.id);
      setEditingNodeId(null);
    } finally {
      setRunningNodeId(null);
    }
  }

  function startLink(nodeId) {
    setSelectedConnectionId(null);
    setLinkFromNodeId((current) => (current === nodeId ? null : nodeId));
    setHoverLinkNodeId(null);
  }

  function handlePortPointerDown(event, nodeId) {
    event.stopPropagation();
    if (linkFromNodeId && linkFromNodeId !== nodeId) {
      finishLink(nodeId);
      return;
    }
    startLink(nodeId);
  }

  function beginLinkDrag(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedConnectionId(null);
    setLinkFromNodeId(nodeId);
    setHoverLinkNodeId(null);

    const point = getStagePoint(event);
    if (point) {
      setPointerPos(point);
    }
  }

  function clearLinkDraft() {
    setLinkFromNodeId(null);
    setHoverLinkNodeId(null);
  }

  function finishLink(targetNodeId) {
    if (!linkFromNodeId || linkFromNodeId === targetNodeId) {
      clearLinkDraft();
      return;
    }

    updateActiveCanvas((doc) => {
      const exists = doc.connections.some(
        (link) => link.fromNodeId === linkFromNodeId && link.toNodeId === targetNodeId
      );

      if (exists) return doc;

      return {
        ...doc,
        connections: [
          ...doc.connections,
          {
            id: uid('link'),
            fromNodeId: linkFromNodeId,
            toNodeId: targetNodeId,
          },
        ],
      };
    });

    clearLinkDraft();
  }

  function getNodeAtPointer(event, sourceNodeId) {
    const point = getStagePoint(event);
    if (!point) return null;
    const { x, y } = point;

    return nodes.find(
      (node) =>
        node.id !== sourceNodeId &&
        x >= node.x &&
        x <= node.x + node.width &&
        y >= node.y &&
        y <= node.y + node.height
    );
  }

  function handleStagePointerMove(event) {
    const point = getStagePoint(event);
    if (!point) return;
    setPointerPos(point);

    if (linkFromNodeId) {
      const target = getNodeAtPointer(event, linkFromNodeId);
      setHoverLinkNodeId(target?.id || null);
    }

    const drag = dragRef.current;
    if (!drag) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const nextX = clampValue(drag.originX + dx, -1200, 2800);
    const nextY = clampValue(drag.originY + dy, -1200, 2200);

    updateNode(drag.nodeId, { x: nextX, y: nextY });
  }

  function handleStagePointerUp(event) {
    dragRef.current = null;
    if (linkFromNodeId) {
      const target = getNodeAtPointer(event, linkFromNodeId);
      if (target) {
        finishLink(target.id);
      } else {
        clearLinkDraft();
      }
    }
  }

  function beginDrag(event, node) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setSelectedConnectionId(null);
    setEditingNodeId(null);
    dragRef.current = {
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
    };
  }

  function handleStagePointerDown(event) {
    const isCanvasBackground =
      event.target === event.currentTarget ||
      (typeof SVGSVGElement !== 'undefined' &&
        event.target instanceof SVGSVGElement &&
        event.target.classList.contains('connection-layer'));

    if (isCanvasBackground) {
      setSelectedNodeId(null);
      setSelectedConnectionId(null);
      setEditingNodeId(null);
      if (linkFromNodeId) clearLinkDraft();
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(documents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'jimicanvas.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    setImportError('');
    fileInputRef.current?.click();
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('文件内容不是有效的画布列表');
        }

        setDocuments(parsed);
        setActiveCanvasId(parsed[0].id);
        setSelectedNodeId(null);
        setSelectedConnectionId(null);
        setEditingNodeId(null);
        clearLinkDraft();
        setImportError('');
      } catch (error) {
        setImportError(error instanceof Error ? error.message : '导入失败');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  return (
    <div className="app-shell">
      <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImport} />

      <aside className="floating-dock" onPointerDown={(event) => event.stopPropagation()}>
        <button
          className={`dock-button canvas-toggle ${showCanvasPanel ? 'active' : ''}`}
          onClick={() => setShowCanvasPanel((value) => !value)}
          title={activeCanvas?.name || '画布管理'}
        >
          <SquarePen size={18} />
        </button>

        <div className="dock-divider" />

        <button className="dock-button" onClick={() => addNode('note')} title="文本节点">
          <FileText size={18} />
        </button>
        <button className="dock-button" onClick={() => addNode('image')} title="图片节点">
          <ImageIcon size={18} />
        </button>
        <button className="dock-button" onClick={() => addNode('video')} title="视频节点">
          <Film size={18} />
        </button>

        <div className="dock-divider" />

        <button className="dock-button" onClick={triggerImport} title="导入画布">
          <FileUp size={18} />
        </button>
        <button className="dock-button" onClick={exportJson} title="导出画布">
          <Download size={18} />
        </button>
      </aside>

      {showCanvasPanel ? (
        <section className="canvas-panel" onPointerDown={(event) => event.stopPropagation()}>
          <header className="panel-header">
            <div className="panel-title">
              <SquarePen size={15} />
              画布管理
            </div>
            <div className="panel-actions">
              <button className="panel-icon success" onClick={createCanvas} title="新增画布">
                <Plus size={15} />
              </button>
              <button className="panel-icon" onClick={() => setShowCanvasPanel(false)} title="关闭">
                <X size={15} />
              </button>
            </div>
          </header>

          <div className="current-canvas">
            <span>当前画布</span>
            <input
              value={activeCanvas?.name || ''}
              onChange={(event) => renameCanvas(event.target.value)}
            />
          </div>

          <div className="canvas-panel-list">
            {[...documents]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((doc) => (
                <div
                  key={doc.id}
                  className={`panel-canvas-item ${doc.id === activeCanvasId ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveCanvasId(doc.id);
                    setSelectedNodeId(null);
                    setSelectedConnectionId(null);
                    setEditingNodeId(null);
                    setLinkFromNodeId(null);
                    setHoverLinkNodeId(null);
                    setShowCanvasPanel(false);
                  }}
                >
                  <div className="panel-canvas-copy">
                    <strong>
                      {doc.name}
                      {doc.id === activeCanvasId ? <span>当前</span> : null}
                    </strong>
                    <small>
                      {doc.nodes.length} 个节点 · {new Date(doc.updatedAt).toLocaleDateString()}
                    </small>
                  </div>
                  <button
                    className="panel-delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteCanvas(doc.id);
                    }}
                    title="删除画布"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {toastError ? <div className="toast-error">{toastError}</div> : null}

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-brand">
            <div className="brand-mark">
              <Wand2 size={18} />
            </div>
            <div className="brand-copy">
              <strong>JimiCanvas</strong>
              <span>轻量画布工作台</span>
            </div>
          </div>

          <div className="topbar-meta">
            <div className="canvas-meta">
              <SquarePen size={16} />
              <input
                className="canvas-name"
                value={activeCanvas?.name || ''}
                onChange={(event) => renameCanvas(event.target.value)}
              />
              <span className="meta-pill">{nodes.length} 节点</span>
              <span className="meta-pill">{connections.length} 连线</span>
            </div>

            <div className="toolbar-row">
              <span className="save-chip">本地自动保存</span>
              <div className="zoom-control" aria-label="画布缩放">
                <button className="icon-mini" onClick={() => zoomCanvas(-CANVAS_SCALE_STEP)} title="缩小画布">
                  <ZoomOut size={14} />
                </button>
                <input
                  className="zoom-slider"
                  type="range"
                  min={MIN_CANVAS_SCALE * 100}
                  max={MAX_CANVAS_SCALE * 100}
                  step={CANVAS_SCALE_STEP * 100}
                  value={canvasScalePercent}
                  onChange={(event) => setCanvasScaleClamped(Number(event.target.value) / 100)}
                  aria-label="画布缩放比例"
                />
                <button className="icon-mini" onClick={() => zoomCanvas(CANVAS_SCALE_STEP)} title="放大画布">
                  <ZoomIn size={14} />
                </button>
                <button className="icon-mini" onClick={resetCanvasScale} title="重置比例">
                  <RotateCcw size={14} />
                </button>
                <span className="meta-pill zoom-label">{canvasScalePercent}%</span>
              </div>
              <button className={`icon-button ${linkFromNodeId ? 'primary' : ''}`} onClick={() => setLinkFromNodeId(null)}>
                <Link2 size={16} />
                {linkFromNodeId ? '取消连线' : '等待连线'}
              </button>
            </div>
          </div>
        </header>

        <section
          className={`stage ${linkFromNodeId ? 'link-mode' : ''}`}
          ref={stageRef}
          style={{ '--canvas-scale': canvasScale }}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerDown={handleStagePointerDown}
        >
          <div className="stage-content">
            <div className="grid-layer" />
            <svg className="connection-layer" width="100%" height="100%">
              <defs>
                <marker
                  id="arrow"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M0,0 L0,6 L6,3 z" fill="#60a5fa" />
                </marker>
              </defs>
              {connections.map((link) => {
                const source = nodes.find((node) => node.id === link.fromNodeId);
                const target = nodes.find((node) => node.id === link.toNodeId);
                if (!source || !target) return null;
                const isSelected = link.id === selectedConnectionId;
                const pathData = getConnectionPath(source, target);
                return (
                  <g key={link.id}>
                    <path
                      className="connection-hit-area"
                      d={pathData}
                      fill="none"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        setSelectedNodeId(null);
                        setSelectedConnectionId(link.id);
                        clearLinkDraft();
                      }}
                    />
                    <path
                      className={`connection-path ${isSelected ? 'selected' : ''}`}
                      d={pathData}
                      fill="none"
                      markerEnd="url(#arrow)"
                    />
                  </g>
                );
              })}
              {linkFromNodeId ? (() => {
                const source = nodes.find((node) => node.id === linkFromNodeId);
                if (!source) return null;
                const x1 = source.x + source.width;
                const y1 = source.y + source.height / 2;
                const x2 = pointerPos.x;
                const y2 = pointerPos.y;
                const bend = Math.max(80, Math.abs(x2 - x1) * 0.35);
                const previewPath = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
                return (
                  <path
                    d={previewPath}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeDasharray="8 8"
                  />
                );
              })() : null}
            </svg>

            {nodes.map((node) => (
              <article
                key={node.id}
                className={`node ${node.id === selectedNodeId ? 'selected' : ''} ${node.type}`}
                style={{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  width: node.width,
                  height: node.height,
                }}
                onPointerDown={(event) => {
                  setSelectedNodeId(node.id);
                  setSelectedConnectionId(null);
                  if (node.type === 'note') {
                    beginDrag(event, node);
                  }
                }}
                onDoubleClick={() => {
                  if (node.type === 'note') {
                    setEditingNodeId(node.id);
                  }
                }}
              >
                <div
                  className="node-floating-header"
                  onPointerDown={(event) => {
                    if (node.type !== 'note') {
                      beginDrag(event, node);
                    }
                  }}
                >
                  <div className="node-title">
                    {node.type === 'image' ? <ImageIcon size={14} /> : node.type === 'video' ? <Film size={14} /> : <FileText size={14} />}
                    <input
                      value={node.title}
                      onChange={(event) => updateNode(node.id, { title: event.target.value })}
                      onPointerDown={(event) => event.stopPropagation()}
                    />
                  </div>
                  <div className="node-header-actions">
                    {node.type === 'note' ? (
                      <button
                        className="icon-mini"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          runTextGeneration(node);
                        }}
                        title="运行文本生成"
                        disabled={runningNodeId === node.id}
                      >
                        {runningNodeId === node.id ? (
                          <LoaderCircle size={14} className="spin-icon" />
                        ) : (
                          <Play size={14} />
                        )}
                      </button>
                    ) : null}
                    <button
                      className="icon-mini danger"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeNode(node.id);
                      }}
                      title="删除节点"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="node-body">
                  {node.type === 'image' ? (
                    <>
                      <input
                        className="node-content-input"
                        value={node.content}
                        onChange={(event) => updateNode(node.id, { content: event.target.value })}
                        onPointerDown={(event) => event.stopPropagation()}
                        placeholder="粘贴图片 URL 或 data URL"
                      />
                      <div className="image-preview">
                        {isImageContent(node.content) ? (
                          <img src={node.content} alt={node.title} />
                        ) : (
                          <div className="image-empty">无可预览内容</div>
                        )}
                      </div>
                    </>
                  ) : node.type === 'video' ? (
                    <>
                      <input
                        className="node-content-input"
                        value={node.content}
                        onChange={(event) => updateNode(node.id, { content: event.target.value })}
                        onPointerDown={(event) => event.stopPropagation()}
                        placeholder="粘贴视频 URL 或 data URL"
                      />
                      <div className="image-preview video-preview">
                        {isVideoContent(node.content) ? (
                          <video src={node.content} controls playsInline />
                        ) : (
                          <div className="image-empty">无可预览内容</div>
                        )}
                      </div>
                    </>
                  ) : runningNodeId === node.id ? (
                    <div className="node-run-state">
                      <LoaderCircle size={22} className="spin-icon" />
                      <span>正在运行</span>
                    </div>
                  ) : node.status === 'error' && editingNodeId !== node.id ? (
                    <div
                      className="node-error-display"
                      onPointerDown={(event) => beginDrag(event, node)}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        setEditingNodeId(node.id);
                      }}
                    >
                      <strong>运行失败</strong>
                      <span>{node.content || '生成失败'}</span>
                    </div>
                  ) : editingNodeId === node.id ? (
                    <textarea
                      autoFocus
                      value={node.content}
                      onChange={(event) => updateNode(node.id, { content: event.target.value, status: 'idle' })}
                      onBlur={() => setEditingNodeId(null)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setEditingNodeId(null);
                        }
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      placeholder="输入文本内容"
                    />
                  ) : (
                    <div
                      className="node-text-display"
                      onPointerDown={(event) => beginDrag(event, node)}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        setEditingNodeId(node.id);
                      }}
                    >
                      {node.content || '双击编辑文字'}
                    </div>
                  )}
                </div>

                <button
                  className={`port output ${linkFromNodeId === node.id ? 'active' : ''}`}
                  onPointerDown={(event) => {
                    handlePortPointerDown(event, node.id);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    if (linkFromNodeId && linkFromNodeId !== node.id) finishLink(node.id);
                  }}
                  title="连线端口"
                />

                <button
                  className={`port input ${linkFromNodeId === node.id ? 'active' : ''}`}
                  onPointerDown={(event) => {
                    handlePortPointerDown(event, node.id);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    if (linkFromNodeId && linkFromNodeId !== node.id) finishLink(node.id);
                  }}
                  title="连线端口"
                />
              </article>
            ))}

            <div className="empty-hint">
              <PencilLine size={14} />
              拖动节点，点击右侧圆点发起连线，再点另一个节点的左侧圆点完成连接。
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
