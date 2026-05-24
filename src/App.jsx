import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AssetPickerModal } from './components/AssetPickerModal';
import { CanvasNode } from './components/CanvasNode';
import { CanvasPanel } from './components/CanvasPanel';
import { CanvasZoomControls } from './components/CanvasZoomControls';
import { ConnectionLayer } from './components/ConnectionLayer';
import { EmptyHint } from './components/EmptyHint';
import { FloatingDock } from './components/FloatingDock';
import { Topbar } from './components/Topbar';
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  JIMIAIGO_TOKEN_STORAGE_KEY,
  MAX_CANVAS_SCALE,
  MIN_CANVAS_SCALE,
  normalizeImageModelSettings,
} from './lib/constants';
import { clampValue, createDocument, createNode, snapScale, uid } from './lib/canvas';
import { getStoredChatToken, runChatCompletion } from './lib/chatApi';
import {
  createImageGenerationTask,
  getAssetList,
  normalizeImageUrl,
  readImageFile,
  uploadAsset,
  waitForImageTask,
} from './lib/imageApi';
import { loadInitialState, writeStorage } from './lib/storage';

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
  const [translatingNodeId, setTranslatingNodeId] = useState(null);
  const [uploadingNodeId, setUploadingNodeId] = useState(null);
  const [showCanvasPanel, setShowCanvasPanel] = useState(false);
  const [assetPicker, setAssetPicker] = useState({
    nodeId: null,
    source: 'local',
    assets: [],
    selectedAssets: [],
    search: '',
    loading: false,
  });

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
    if (!assetPicker.nodeId) return;
    loadAssetPickerAssets(assetPicker.source);
  }, [assetPicker.nodeId, assetPicker.source]);

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
    clearSelection();
  }

  function selectCanvas(canvasId) {
    setActiveCanvasId(canvasId);
    clearSelection();
    setShowCanvasPanel(false);
  }

  function renameCanvas(name) {
    updateActiveCanvas((doc) => ({ ...doc, name }));
  }

  function deleteCanvas(canvasId) {
    if (documents.length === 1) {
      const replacement = createDocument('画布 1', false);
      setDocuments([replacement]);
      setActiveCanvasId(replacement.id);
      clearSelection();
      return;
    }

    const next = documents.filter((doc) => doc.id !== canvasId);
    setDocuments(next);
    if (canvasId === activeCanvasId) {
      setActiveCanvasId(next[0]?.id || null);
      clearSelection();
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

  function getOrRequestToken() {
    let token = getStoredChatToken();
    if (!token && typeof window !== 'undefined') {
      const input = window.prompt('请输入 Jimiaigo 的 token');
      if (input) {
        token = String(input).trim();
        window.localStorage.setItem(JIMIAIGO_TOKEN_STORAGE_KEY, token);
      }
    }
    return token;
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
      clearLinkDraft();
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

  async function runTextGeneration(node, mode = 'generate') {
    const promptText = String(node.prompt || node.content || node.title || '').trim();
    if (!promptText) {
      updateNode(node.id, { content: '文本节点内容为空', status: 'error' });
      return;
    }

    const token = getOrRequestToken();

    if (!token) {
      updateNode(node.id, { content: '缺少 token', status: 'error' });
      return;
    }

    const requestText =
      mode === 'translate-en'
        ? `Detect whether the following text is primarily Chinese or English. If it is Chinese, translate it into natural English. If it is English, translate it into natural Chinese. Return only the translation, with no explanations:\n\n${promptText}`
        : promptText;

    if (mode === 'translate-en') {
      setTranslatingNodeId(node.id);
    } else {
      setRunningNodeId(node.id);
    }

    try {
      const generated = await runChatCompletion({ token, content: requestText });

      if (mode === 'translate-en') {
        updateNode(node.id, { prompt: generated, status: 'idle' });
      } else {
        updateNode(node.id, { content: generated, status: 'idle' });
      }
      setSelectedNodeId(node.id);
      setEditingNodeId(mode === 'translate-en' ? null : node.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      updateNode(node.id, { content: message, status: 'error' });
      setSelectedNodeId(node.id);
      setEditingNodeId(null);
    } finally {
      if (mode === 'translate-en') {
        setTranslatingNodeId(null);
      } else {
        setRunningNodeId(null);
      }
    }
  }

  async function runImageGeneration(node, mode = 'generate') {
    const promptText = String(node.prompt || '').trim();
    if (!promptText) {
      updateNode(node.id, { content: '图片提示词不能为空', status: 'error' });
      return;
    }

    const token = getOrRequestToken();

    if (!token) {
      updateNode(node.id, { content: '缺少 token', status: 'error' });
      return;
    }

    if (mode === 'translate') {
      setTranslatingNodeId(node.id);
      try {
        const translated = await runChatCompletion({
          token,
          content: `Detect whether the following image prompt is primarily Chinese or English. If it is Chinese, translate it into natural English. If it is English, translate it into natural Chinese. Return only the translation, with no explanations:\n\n${promptText}`,
        });
        updateNode(node.id, { prompt: translated, status: 'idle' });
        setSelectedNodeId(node.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : '翻译失败';
        updateNode(node.id, { content: message, status: 'error' });
        setSelectedNodeId(node.id);
      } finally {
        setTranslatingNodeId(null);
      }
      return;
    }

    setRunningNodeId(node.id);
    updateNode(node.id, { status: 'running' });

    try {
      const settings = normalizeImageModelSettings({
        model: node.imageModel,
        resolution: node.imageResolution,
        ratio: node.imageRatio,
        count: node.imageCount,
      });
      const count = settings.count;
      const images = [];

      for (let index = 0; index < count; index += 1) {
        const taskId = await createImageGenerationTask({
          token,
          prompt: promptText,
          model: settings.model,
          ratio: settings.ratio,
          resolution: settings.resolution,
          referenceImages: node.referenceImages || [],
        });
        const taskImages = await waitForImageTask({ token, taskId });
        images.push(...taskImages);
        updateNode(node.id, {
          content: images[0],
          images,
          status: 'running',
        });
      }

      updateNode(node.id, {
        content: images[0],
        images,
        status: 'idle',
      });
      setSelectedNodeId(node.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片生成失败';
      updateNode(node.id, { content: message, status: 'error' });
      setSelectedNodeId(node.id);
    } finally {
      setRunningNodeId(null);
    }
  }

  async function uploadImageReferences(nodeId, files) {
    const token = getOrRequestToken();
    if (!token) {
      updateNode(nodeId, { content: '缺少 token', status: 'error' });
      return;
    }

    setUploadingNodeId(nodeId);
    try {
      const references = [];
      for (const file of files.slice(0, 5)) {
        const localImage = await readImageFile(file);
        const uploadedUrl = await uploadAsset({ token, file });
        references.push({
          ...localImage,
          url: normalizeImageUrl(uploadedUrl || localImage.url),
          uploadedUrl,
        });
      }

      updateActiveCanvas((doc) => ({
        ...doc,
        nodes: doc.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const current = Array.isArray(node.referenceImages) ? node.referenceImages : [];
          return {
            ...node,
            referenceImages: [...current, ...references].slice(0, 5),
            status: 'idle',
          };
        }),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传图片失败';
      updateNode(nodeId, { content: message, status: 'error' });
    } finally {
      setUploadingNodeId(null);
    }
  }

  function removeImageReference(nodeId, index) {
    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const references = Array.isArray(node.referenceImages) ? node.referenceImages : [];
        return {
          ...node,
          referenceImages: references.filter((_, itemIndex) => itemIndex !== index),
        };
      }),
    }));
  }

  function openAssetLibrary(nodeId) {
    setAssetPicker({
      nodeId,
      source: 'local',
      assets: [],
      selectedAssets: [],
      search: '',
      loading: true,
    });
  }

  async function loadAssetPickerAssets(source) {
    const token = getOrRequestToken();
    if (!token) {
      setAssetPicker((current) => ({ ...current, loading: false }));
      return;
    }

    setAssetPicker((current) => ({ ...current, loading: true, assets: [] }));
    try {
      const result = await getAssetList({ token, source, page: 1, pageSize: 36 });
      setAssetPicker((current) => ({
        ...current,
        assets: result.list || [],
        loading: false,
      }));
    } catch {
      setAssetPicker((current) => ({ ...current, assets: [], loading: false }));
    }
  }

  function toggleAssetSelection(asset) {
    setAssetPicker((current) => {
      const exists = current.selectedAssets.some((item) => item.id === asset.id);
      if (exists) {
        return {
          ...current,
          selectedAssets: current.selectedAssets.filter((item) => item.id !== asset.id),
        };
      }
      if (current.selectedAssets.length >= 5) return current;
      return {
        ...current,
        selectedAssets: [...current.selectedAssets, asset],
      };
    });
  }

  function confirmAssetSelection() {
    const { nodeId, selectedAssets } = assetPicker;
    if (!nodeId || selectedAssets.length === 0) return;

    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const current = Array.isArray(node.referenceImages) ? node.referenceImages : [];
        const normalized = selectedAssets.map((asset) => ({
          id: asset.id,
          name: asset.name || '图片资产',
          url: assetPicker.source === 'local' ? asset.url : normalizeImageUrl(asset.url),
          source: assetPicker.source,
          type: 'image',
        }));
        return {
          ...node,
          referenceImages: [...current, ...normalized].slice(0, 5),
          status: 'idle',
        };
      }),
    }));

    setAssetPicker((current) => ({ ...current, nodeId: null, selectedAssets: [] }));
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

  function clearLinkDraft() {
    setLinkFromNodeId(null);
    setHoverLinkNodeId(null);
  }

  function clearSelection() {
    setSelectedNodeId(null);
    setSelectedConnectionId(null);
    setEditingNodeId(null);
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

  function selectConnection(connectionId) {
    setSelectedNodeId(null);
    setSelectedConnectionId(connectionId);
    clearLinkDraft();
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

      <FloatingDock
        activeCanvas={activeCanvas}
        showCanvasPanel={showCanvasPanel}
        onToggleCanvasPanel={() => setShowCanvasPanel((value) => !value)}
        onAddNode={addNode}
        onImport={triggerImport}
        onExport={exportJson}
      />

      {showCanvasPanel ? (
        <CanvasPanel
          documents={documents}
          activeCanvas={activeCanvas}
          activeCanvasId={activeCanvasId}
          onCreateCanvas={createCanvas}
          onRenameCanvas={renameCanvas}
          onSelectCanvas={selectCanvas}
          onDeleteCanvas={deleteCanvas}
          onClose={() => setShowCanvasPanel(false)}
        />
      ) : null}

      {importError ? <div className="toast-error">{importError}</div> : null}

      {assetPicker.nodeId ? (
        <AssetPickerModal
          assets={assetPicker.assets}
          loading={assetPicker.loading}
          source={assetPicker.source}
          search={assetPicker.search}
          selectedAssets={assetPicker.selectedAssets}
          maxCount={5}
          onSourceChange={(source) =>
            setAssetPicker((current) => ({ ...current, source, selectedAssets: [] }))
          }
          onSearchChange={(search) => setAssetPicker((current) => ({ ...current, search }))}
          onToggleAsset={toggleAssetSelection}
          onUploadImages={(files) => uploadImageReferences(assetPicker.nodeId, files)}
          onConfirm={confirmAssetSelection}
          onClose={() => setAssetPicker((current) => ({ ...current, nodeId: null }))}
        />
      ) : null}

      <main className="workspace">
        <Topbar
          activeCanvas={activeCanvas}
          nodesCount={nodes.length}
          connectionsCount={connections.length}
          onRenameCanvas={renameCanvas}
        />

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
            <ConnectionLayer
              nodes={nodes}
              connections={connections}
              selectedConnectionId={selectedConnectionId}
              linkFromNodeId={linkFromNodeId}
              pointerPos={pointerPos}
              onSelectConnection={selectConnection}
            />

            {nodes.map((node) => (
              <CanvasNode
                key={node.id}
                node={node}
                isSelected={node.id === selectedNodeId}
                isEditing={node.id === editingNodeId}
                isRunning={runningNodeId === node.id}
                isTranslating={translatingNodeId === node.id}
                linkFromNodeId={linkFromNodeId}
                onSelectNode={setSelectedNodeId}
                onClearConnectionSelection={() => setSelectedConnectionId(null)}
                onBeginDrag={beginDrag}
                onEdit={setEditingNodeId}
                onStopEditing={() => setEditingNodeId(null)}
                onUpdateNode={updateNode}
                onRemoveNode={removeNode}
                onRunTextGeneration={runTextGeneration}
                onRunImageGeneration={runImageGeneration}
                onOpenAssetLibrary={openAssetLibrary}
                onRemoveImageReference={removeImageReference}
                onPortPointerDown={handlePortPointerDown}
                onFinishLink={finishLink}
              />
            ))}

            <EmptyHint />
          </div>
          <CanvasZoomControls
            canvasScalePercent={canvasScalePercent}
            onZoom={zoomCanvas}
            onScaleChange={setCanvasScaleClamped}
            onResetScale={resetCanvasScale}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
