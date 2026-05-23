import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Download,
  FileUp,
  Image as ImageIcon,
  Film,
  Link2,
  PencilLine,
  Plus,
  SquarePen,
  Trash2,
  Wand2,
  CircleDot,
  FileText,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'jimicanvas.documents.v1';
const DEFAULT_NODE_WIDTH = 260;
const DEFAULT_NODE_HEIGHT = 180;
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

function App() {
  const initial = useMemo(() => loadInitialState(), []);
  const [documents, setDocuments] = useState(initial.documents);
  const [activeCanvasId, setActiveCanvasId] = useState(initial.activeCanvasId);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [linkFromNodeId, setLinkFromNodeId] = useState(null);
  const [hoverLinkNodeId, setHoverLinkNodeId] = useState(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [importError, setImportError] = useState('');
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
      setHoverLinkNodeId(null);
    }
  }, [documents, activeCanvasId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLinkFromNodeId(null);
        setHoverLinkNodeId(null);
      }

      if (event.key === 'Delete' && selectedNodeId) {
        event.preventDefault();
        removeNode(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId]);

  const activeCanvas = documents.find((doc) => doc.id === activeCanvasId) || documents[0];
  const nodes = activeCanvas?.nodes || [];
  const connections = activeCanvas?.connections || [];
  const activeNode = nodes.find((node) => node.id === selectedNodeId) || null;

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
      setLinkFromNodeId(null);
      setHoverLinkNodeId(null);
      return;
    }

    const next = documents.filter((doc) => doc.id !== canvasId);
    setDocuments(next);
    if (canvasId === activeCanvasId) {
      setActiveCanvasId(next[0]?.id || null);
      setSelectedNodeId(null);
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
    if (linkFromNodeId === nodeId) {
      setLinkFromNodeId(null);
      setHoverLinkNodeId(null);
    }
  }

  function startLink(nodeId) {
    setLinkFromNodeId((current) => (current === nodeId ? null : nodeId));
    setHoverLinkNodeId(null);
  }

  function beginLinkDrag(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(nodeId);
    setLinkFromNodeId(nodeId);
    setHoverLinkNodeId(null);

    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) {
      setPointerPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
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
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

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
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPointerPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });

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
    dragRef.current = {
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
    };
  }

  function handleStagePointerDown(event) {
    if (event.target === event.currentTarget) {
      setSelectedNodeId(null);
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

      {activeNode ? (
        <section className="node-inspector-panel" onPointerDown={(event) => event.stopPropagation()}>
          <header className="panel-header">
            <div className="panel-title">
              <PencilLine size={15} />
              节点详情
            </div>
            <button className="panel-icon" onClick={() => setSelectedNodeId(null)} title="关闭">
              <X size={15} />
            </button>
          </header>

          <div className="inspector">
            <label>
              标题
              <input
                value={activeNode.title}
                onChange={(event) => updateNode(activeNode.id, { title: event.target.value })}
              />
            </label>
            <label>
              类型
              <div className="toggle-row">
                <button
                  className={`toggle ${activeNode.type === 'note' ? 'active' : ''}`}
                  onClick={() => updateNode(activeNode.id, { type: 'note' })}
                >
                  <FileText size={14} />
                  文本
                </button>
                <button
                  className={`toggle ${activeNode.type === 'image' ? 'active' : ''}`}
                  onClick={() =>
                    updateNode(activeNode.id, {
                      type: 'image',
                      content: isImageContent(activeNode.content) ? activeNode.content : PLACEHOLDER_IMAGE,
                    })
                  }
                >
                  <ImageIcon size={14} />
                  图片
                </button>
                <button
                  className={`toggle ${activeNode.type === 'video' ? 'active' : ''}`}
                  onClick={() =>
                    updateNode(activeNode.id, {
                      type: 'video',
                      content: isVideoContent(activeNode.content) ? activeNode.content : DEFAULT_VIDEO_URL,
                    })
                  }
                >
                  <Film size={14} />
                  视频
                </button>
              </div>
            </label>
            <label>
              内容
              <textarea
                rows={7}
                value={activeNode.content}
                onChange={(event) => updateNode(activeNode.id, { content: event.target.value })}
              />
            </label>
            <button className="icon-button danger-button" onClick={() => removeNode(activeNode.id)}>
              <Trash2 size={16} />
              删除节点
            </button>
          </div>
        </section>
      ) : null}

      {importError ? <div className="toast-error">{importError}</div> : null}

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
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerDown={handleStagePointerDown}
        >
          <div className="grid-layer" />
          <svg className="connection-layer" width="100%" height="100%">
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="#60a5fa" />
              </marker>
            </defs>
            {connections.map((link) => {
              const source = nodes.find((node) => node.id === link.fromNodeId);
              const target = nodes.find((node) => node.id === link.toNodeId);
              if (!source || !target) return null;
              return (
                <path
                  key={link.id}
                  d={getConnectionPath(source, target)}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="3"
                  markerEnd="url(#arrow)"
                />
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
              onPointerDown={() => setSelectedNodeId(node.id)}
            >
              <header className="node-header" onPointerDown={(event) => beginDrag(event, node)}>
                <div className="node-title">
                  {node.type === 'image' ? <ImageIcon size={14} /> : node.type === 'video' ? <Film size={14} /> : <FileText size={14} />}
                  <input
                    value={node.title}
                    onChange={(event) => updateNode(node.id, { title: event.target.value })}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                </div>
                <div className="node-header-actions">
                  <button
                    className={`icon-mini ${linkFromNodeId === node.id ? 'active' : ''}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      startLink(node.id);
                    }}
                    title="发起连线"
                  >
                    <Link2 size={14} />
                  </button>
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
              </header>

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
                ) : (
                  <textarea
                    value={node.content}
                    onChange={(event) => updateNode(node.id, { content: event.target.value })}
                    onPointerDown={(event) => event.stopPropagation()}
                    placeholder="输入文本内容"
                  />
                )}
              </div>

              <button
                className={`port output ${linkFromNodeId === node.id ? 'active' : ''}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startLink(node.id);
                }}
                title="输出端口"
              >
                <ArrowRight size={12} />
              </button>

              <button
                className="port input"
                onPointerUp={(event) => {
                  event.stopPropagation();
                  finishLink(node.id);
                }}
                title="输入端口"
              >
                <CircleDot size={12} />
              </button>
            </article>
          ))}

          <div className="empty-hint">
            <PencilLine size={14} />
            拖动节点，点击右侧圆点发起连线，再点另一个节点的左侧圆点完成连接。
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
