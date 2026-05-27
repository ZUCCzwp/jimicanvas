import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AssetPickerModal } from './components/AssetPickerModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { VideoPreviewModal } from './components/VideoPreviewModal';
import { NodeTypePickerPopover } from './components/NodeTypePickerPopover';
import { TextEditModal } from './components/TextEditModal';
import { CanvasNode } from './components/CanvasNode';
import { CanvasPanel } from './components/CanvasPanel';
import { CanvasZoomControls } from './components/CanvasZoomControls';
import { FocusContentPrompt } from './components/FocusContentPrompt';
import { ConnectionLayer } from './components/ConnectionLayer';
import { FloatingDock } from './components/FloatingDock';
import { CustomerServiceModal } from './components/CustomerServiceModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { RechargeModal } from './components/RechargeModal';
import { Topbar } from './components/Topbar';
import { isEditableKeyboardTarget } from './lib/keyboardShortcuts';
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  JIMIAIGO_TOKEN_STORAGE_KEY,
  CANVAS_GRID_CELL_SIZE,
  CANVAS_SCALE_STEP,
  CANVAS_WHEEL_PAN_FACTOR,
  CLOUD_SYNC_DEBOUNCE_MS,
  MAX_CANVAS_SCALE,
  MIN_CANVAS_SCALE,
  normalizeImageModelSettings,
  inferVideoFamily,
  normalizeVideoModelSettings,
  VEO_REFERENCE_IMAGE_MAX,
} from './lib/constants';
import {
  clampNoteSize,
  clampValue,
  createDocument,
  createNode,
  duplicateNode,
  computeViewportFocusForNodes,
  getNodesInSelectionRect,
  getViewportRectInCanvas,
  hasVisibleNodesInViewport,
  normalizeSelectionRect,
  snapScale,
  uid,
} from './lib/canvas';
import {
  getImageInputLinks,
  getTextInputLinks,
  resolveImagePrompt,
  resolveVideoPrompt,
  resolveVideoReferenceImages,
} from './lib/connections';
import {
  fetchCanvasDocuments,
  parseCloudDocuments,
  saveCanvasDocuments,
  saveCanvasDocumentsKeepalive,
} from './lib/canvasApi';
import { getStoredChatToken, runChatCompletion } from './lib/chatApi';
import { fetchUserInfo } from './lib/userApi';
import { fetchSiteConfig, getDefaultSiteSettings } from './lib/siteApi';
import {
  createImageGenerationTask,
  getAssetList,
  normalizeImageUrl,
  readImageFile,
  uploadAsset,
} from './lib/imageApi';
import { buildImageNodeLayoutPatch } from './lib/imageNodeLayout';
import {
  executeImageGeneration,
  executeVideoGeneration,
  isNodeActivelyRunning,
  mergeDocumentsPreservePending,
  recoverPendingTasks,
  recoverTaskKey,
  countDocumentNodes,
  documentMaxUpdatedAt,
  shouldPreferLocalDocuments,
} from './lib/generationResume';
import {
  hasStorageBackup,
  isBackupDifferentFrom,
  loadInitialState,
  readStorageBackup,
  writeStorage,
} from './lib/storage';
import { createVideoGenerationTask, downloadVideoFile } from './lib/videoApi';

function App() {
  const initial = useMemo(() => loadInitialState(), []);
  const [documents, setDocuments] = useState(initial.documents);
  const [storageNotice, setStorageNotice] = useState(() => {
    if (initial.loadedFrom === 'backup') {
      return '已从本地备份恢复画布，建议点击左侧导出按钮保存一份 JSON';
    }
    return '';
  });
  const [activeCanvasId, setActiveCanvasId] = useState(initial.activeCanvasId);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectionMarquee, setSelectionMarquee] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [enlargedTextEdit, setEnlargedTextEdit] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [linkFromNodeId, setLinkFromNodeId] = useState(null);
  const [linkNodePicker, setLinkNodePicker] = useState(null);
  const [inputHighlightNodeId, setInputHighlightNodeId] = useState(null);
  const [hoverLinkNodeId, setHoverLinkNodeId] = useState(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [importError, setImportError] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [runningNodeId, setRunningNodeId] = useState(null);
  const [translatingNodeId, setTranslatingNodeId] = useState(null);
  const [uploadingNodeId, setUploadingNodeId] = useState(null);
  const [showCanvasPanel, setShowCanvasPanel] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showCustomerService, setShowCustomerService] = useState(false);
  const [siteSettings, setSiteSettings] = useState(getDefaultSiteSettings);
  const [assetPicker, setAssetPicker] = useState({
    nodeId: null,
    pickMode: 'reference',
    maxCount: 5,
    title: '资产库',
    subtitle: '选择图片作为参考图',
    source: 'local',
    assets: [],
    selectedAssets: [],
    search: '',
    loading: false,
  });

  const stageRef = useRef(null);
  const copiedNodeRef = useRef(null);
  const pasteGenerationRef = useRef(0);
  const copyNoticeTimerRef = useRef(null);
  const canvasScaleRef = useRef(canvasScale);
  const viewportOffsetRef = useRef(viewportOffset);
  const fileInputRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const panRef = useRef(null);
  const marqueeRef = useRef(null);
  const spaceKeyRef = useRef(false);
  const cloudVersionRef = useRef(0);
  const cloudSyncReadyRef = useRef(false);
  const skipCloudSaveRef = useRef(true);
  const [cloudSyncStatus, setCloudSyncStatus] = useState(() =>
    getStoredChatToken() ? 'loading' : 'offline'
  );
  const [cloudLastSyncedAt, setCloudLastSyncedAt] = useState(null);
  const [userQuota, setUserQuota] = useState(() => ({
    loading: Boolean(getStoredChatToken()),
    remaining: null,
    percentage: null,
    profile: null,
  }));
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [hydrationDone, setHydrationDone] = useState(false);
  const recoveredTaskKeysRef = useRef(new Set());
  const recoveryStartedRef = useRef(false);
  const documentsRef = useRef(documents);
  const activeCanvasIdRef = useRef(activeCanvasId);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    activeCanvasIdRef.current = activeCanvasId;
  }, [activeCanvasId]);

  useEffect(() => {
    canvasScaleRef.current = canvasScale;
  }, [canvasScale]);

  useEffect(() => {
    viewportOffsetRef.current = viewportOffset;
  }, [viewportOffset]);

  const refreshUserQuota = async () => {
    const token = getStoredChatToken();
    if (!token) {
      setUserQuota({ loading: false, remaining: null, percentage: null, profile: null });
      return;
    }

    setUserQuota((prev) => ({
      ...prev,
      loading: true,
    }));

    try {
      const info = await fetchUserInfo(token);
      setUserQuota({
        loading: false,
        remaining: info.remaining,
        percentage: info.percentage,
        profile: info.profile || null,
      });
    } catch {
      setUserQuota((prev) => ({
        ...prev,
        loading: false,
      }));
    }
  };

  useEffect(() => {
    refreshUserQuota();
  }, []);

  function openRechargeModal() {
    const token = getStoredChatToken();
    if (!token) {
      const requested = getOrRequestToken();
      if (!requested) return;
    }
    refreshUserQuota();
    setShowRechargeModal(true);
  }

  const flushPersist = async () => {
    writeStorage(documentsRef.current);
    const token = getStoredChatToken();
    if (!token || skipCloudSaveRef.current) return;
    try {
      const saved = await saveCanvasDocuments(token, {
        documents: documentsRef.current,
        activeCanvasId: activeCanvasIdRef.current,
        version: cloudVersionRef.current,
      });
      if (saved?.version != null) {
        cloudVersionRef.current = saved.version;
      }
      setCloudLastSyncedAt(Date.now());
      setCloudSyncStatus('synced');
    } catch {
      setCloudSyncStatus('pending');
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromCloud() {
      const token = getStoredChatToken();
      if (!token) {
        setCloudSyncStatus('offline');
        cloudSyncReadyRef.current = true;
        skipCloudSaveRef.current = false;
        setHydrationDone(true);
        return;
      }

      setCloudSyncStatus('loading');

      try {
        const cloud = await fetchCanvasDocuments(token);
        if (cancelled) return;

        const cloudDocs = parseCloudDocuments(cloud?.documents);
        const localDocs = documentsRef.current;
        const localChangedSinceMount =
          documentMaxUpdatedAt(localDocs) > documentMaxUpdatedAt(initial.documents) ||
          countDocumentNodes(localDocs) > countDocumentNodes(initial.documents);
        if (cloudDocs?.length) {
          const preferLocal =
            localChangedSinceMount ||
            shouldPreferLocalDocuments(localDocs, cloudDocs, cloud?.updated_at);
          const nextDocs = preferLocal
            ? mergeDocumentsPreservePending(localDocs, cloudDocs)
            : cloudDocs;
          setDocuments(nextDocs);
          setActiveCanvasId(
            (preferLocal ? activeCanvasIdRef.current : cloud.active_canvas_id) ||
              nextDocs[0]?.id
          );
          cloudVersionRef.current = Number(cloud.version) || 0;
          writeStorage(nextDocs);
          setStorageNotice((prev) =>
            preferLocal
              ? localChangedSinceMount
                ? '已保留你刚编辑的画布，并与云端合并'
                : '已保留本地进行中的任务，并与云端画布合并'
              : prev && !prev.includes('云端')
                ? prev
                : '已从云端同步画布'
          );
        } else if (
          initial.loadedFrom !== 'default' ||
          countDocumentNodes(localDocs) > 0
        ) {
          const saved = await saveCanvasDocuments(token, {
            documents: localDocs,
            activeCanvasId: activeCanvasIdRef.current,
            version: Number(cloud?.version) || 0,
          });
          if (!cancelled && saved?.version != null) {
            cloudVersionRef.current = saved.version;
          }
        }
        if (!cancelled) {
          setCloudLastSyncedAt(Date.now());
          setCloudSyncStatus('synced');
        }
      } catch {
        if (!cancelled) {
          setCloudSyncStatus('error');
        }
      } finally {
        if (!cancelled) {
          cloudSyncReadyRef.current = true;
          skipCloudSaveRef.current = false;
          setHydrationDone(true);
        }
      }
    }

    hydrateFromCloud();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cloudSyncReadyRef.current || skipCloudSaveRef.current) return undefined;

    const token = getStoredChatToken();
    if (!token) {
      setCloudSyncStatus('offline');
      return undefined;
    }

    setCloudSyncStatus('pending');

    const timer = window.setTimeout(async () => {
      setCloudSyncStatus('saving');
      try {
        const saved = await saveCanvasDocuments(token, {
          documents,
          activeCanvasId,
          version: cloudVersionRef.current,
        });
        if (saved?.version != null) {
          cloudVersionRef.current = saved.version;
        }
        setCloudLastSyncedAt(Date.now());
        setCloudSyncStatus('synced');
      } catch (error) {
        if (error?.isConflict && error.latest) {
          cloudVersionRef.current = Number(error.latest.version) || cloudVersionRef.current;
          const latestDocs = parseCloudDocuments(error.latest.documents);
          if (latestDocs?.length) {
            setDocuments((prev) => {
              const merged = mergeDocumentsPreservePending(prev, latestDocs);
              writeStorage(merged);
              return merged;
            });
            setActiveCanvasId((current) => current || error.latest.active_canvas_id || latestDocs[0]?.id);
          }
          setCloudLastSyncedAt(Date.now());
          setCloudSyncStatus('synced');
          setStorageNotice('云端画布已被其他设备更新，已为你拉取最新版本');
          return;
        }
        setCloudSyncStatus('error');
      }
    }, CLOUD_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [documents, activeCanvasId]);

  useEffect(() => {
    const result = writeStorage(documents);
    if (!result.ok) {
      setStorageNotice(
        '画布保存到浏览器失败，存储空间可能已满。请尽快导出 JSON，或删除节点里过大的本地图片后再试。'
      );
      return;
    }
    if (storageNotice.startsWith('画布保存到浏览器失败')) {
      setStorageNotice('');
    }
  }, [documents]);

  useEffect(() => {
    function persistOnExit() {
      writeStorage(documentsRef.current);
      const token = getStoredChatToken();
      if (token && cloudSyncReadyRef.current && !skipCloudSaveRef.current) {
        saveCanvasDocumentsKeepalive(token, {
          documents: documentsRef.current,
          activeCanvasId: activeCanvasIdRef.current,
          version: cloudVersionRef.current,
        });
      }
    }

    window.addEventListener('beforeunload', persistOnExit);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        persistOnExit();
      }
    });
    return () => {
      window.removeEventListener('beforeunload', persistOnExit);
    };
  }, []);

  useEffect(() => {
    if (!documents.some((doc) => doc.id === activeCanvasId)) {
      setActiveCanvasId(documents[0]?.id || null);
      setSelectedNodeIds([]);
      setSelectedConnectionId(null);
      setEnlargedTextEdit(null);
      setHoverLinkNodeId(null);
    }
  }, [documents, activeCanvasId]);

  useEffect(() => {
    if (!assetPicker.nodeId) return;
    loadAssetPickerAssets(assetPicker.source);
  }, [assetPicker.nodeId, assetPicker.source]);

  useEffect(() => {
    let cancelled = false;

    fetchSiteConfig().then((settings) => {
      if (cancelled) return;
      setSiteSettings(settings);
      if (settings.title) {
        document.title = settings.title;
      }
      if (settings.logoUrl) {
        let link = document.querySelector('link[rel*="icon"]');
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = settings.logoUrl;
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setViewportOffset({ x: 0, y: 0 });
  }, [activeCanvasId]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const updateStageSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };

    updateStageSize();
    const observer = new ResizeObserver(updateStageSize);
    observer.observe(stage);
    window.addEventListener('resize', updateStageSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateStageSize);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleWheel = (event) => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();

        const rect = stage.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const oldScale = canvasScaleRef.current;
        const offset = viewportOffsetRef.current;
        const normalizedDeltaY = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;

        if (Math.abs(normalizedDeltaY) < 0.01) return;

        const nextScale = clampValue(
          oldScale * Math.pow(1.002, -normalizedDeltaY),
          MIN_CANVAS_SCALE,
          MAX_CANVAS_SCALE
        );

        if (Math.abs(nextScale - oldScale) < 0.0001) return;

        const canvasX = (pointerX - offset.x) / oldScale;
        const canvasY = (pointerY - offset.y) / oldScale;

        setCanvasScale(nextScale);
        setViewportOffset({
          x: pointerX - canvasX * nextScale,
          y: pointerY - canvasY * nextScale,
        });
        return;
      }

      if (isEditableTarget) return;

      event.preventDefault();

      const useShiftAsHorizontal = event.shiftKey && event.deltaX === 0;
      const deltaX = (useShiftAsHorizontal ? event.deltaY : event.deltaX) * CANVAS_WHEEL_PAN_FACTOR;
      const deltaY = (useShiftAsHorizontal ? 0 : event.deltaY) * CANVAS_WHEEL_PAN_FACTOR;

      setViewportOffset((current) => ({
        x: current.x - deltaX,
        y: current.y - deltaY,
      }));
    };

    stage.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => stage.removeEventListener('wheel', handleWheel, { capture: true });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isEditableKeyboardTarget(event.target)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        spaceKeyRef.current = true;
      }
    };
    const handleKeyUp = (event) => {
      if (event.code === 'Space') {
        spaceKeyRef.current = false;
      }
    };
    const handleBlur = () => {
      spaceKeyRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isEditableKeyboardTarget(event.target)) return;

      if (event.key === 'Escape') {
        if (showCustomerService) {
          setShowCustomerService(false);
          return;
        }
        if (showKeyboardShortcuts) {
          setShowKeyboardShortcuts(false);
          return;
        }
        if (showCanvasPanel) {
          setShowCanvasPanel(false);
          return;
        }
        setLinkFromNodeId(null);
        setHoverLinkNodeId(null);
        setLinkNodePicker(null);
        setInputHighlightNodeId(null);
        setEnlargedTextEdit(null);
        setImagePreview(null);
        setVideoPreview(null);
        setSelectedConnectionId(null);
        setSelectedNodeIds([]);
        return;
      }

      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        setShowKeyboardShortcuts(true);
        return;
      }

      const isMeta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const primarySelectedNodeId = selectedNodeIds[selectedNodeIds.length - 1];

      if (isMeta && key === 'c' && primarySelectedNodeId) {
        event.preventDefault();
        if (copyNode(primarySelectedNodeId)) {
          showCopyNotice('已复制节点，按 ⌘V 粘贴');
        }
        return;
      }

      if (isMeta && key === 'v') {
        event.preventDefault();
        if (pasteCopiedNode()) {
          showCopyNotice('已粘贴节点');
        }
        return;
      }

      if (isMeta && key === 'd' && primarySelectedNodeId) {
        event.preventDefault();
        duplicateNodeById(primarySelectedNodeId);
        return;
      }

      if (isMeta && key === '0') {
        event.preventDefault();
        resetCanvasScale();
        return;
      }

      if (isMeta && (key === '=' || key === '+' || key === '-')) {
        event.preventDefault();
        zoomCanvas(key === '-' ? -CANVAS_SCALE_STEP : CANVAS_SCALE_STEP);
        return;
      }

      if (!isMeta && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        zoomCanvas(CANVAS_SCALE_STEP);
        return;
      }

      if (!isMeta && event.key === '-') {
        event.preventDefault();
        zoomCanvas(-CANVAS_SCALE_STEP);
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedConnectionId) {
        event.preventDefault();
        removeConnection(selectedConnectionId);
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeIds.length > 0) {
        event.preventDefault();
        removeNodes(selectedNodeIds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConnectionId, selectedNodeIds, showCanvasPanel, showCustomerService, showKeyboardShortcuts]);

  const activeCanvas = documents.find((doc) => doc.id === activeCanvasId) || documents[0];
  const nodes = activeCanvas?.nodes || [];
  const connections = activeCanvas?.connections || [];
  const primarySelectedNodeId =
    selectedNodeIds.length > 0 ? selectedNodeIds[selectedNodeIds.length - 1] : null;
  const highlightedConnectionIds = useMemo(() => {
    if (!inputHighlightNodeId) return [];
    return connections
      .filter((link) => link.toNodeId === inputHighlightNodeId)
      .map((link) => link.id);
  }, [connections, inputHighlightNodeId]);
  const orderedNodes = useMemo(() => {
    if (selectedNodeIds.length === 0) return nodes;
    const selectedSet = new Set(selectedNodeIds);
    return [
      ...nodes.filter((node) => !selectedSet.has(node.id)),
      ...nodes.filter((node) => selectedSet.has(node.id)),
    ];
  }, [nodes, selectedNodeIds]);
  const canvasScalePercent = Math.round(canvasScale * 100);
  const showFocusContentPrompt = useMemo(() => {
    if (nodes.length === 0 || stageSize.width <= 0 || stageSize.height <= 0) return false;

    const viewportRect = getViewportRectInCanvas(
      stageSize.width,
      stageSize.height,
      canvasScale,
      viewportOffset.x,
      viewportOffset.y
    );

    return !hasVisibleNodesInViewport(nodes, viewportRect);
  }, [canvasScale, nodes, stageSize.height, stageSize.width, viewportOffset.x, viewportOffset.y]);
  const enlargedTextEditNode =
    enlargedTextEdit &&
    nodes.find((node) => node.id === enlargedTextEdit.nodeId && node.type === 'note');

  function setCanvasScaleClamped(nextScale) {
    setCanvasScale(snapScale(clampValue(nextScale, MIN_CANVAS_SCALE, MAX_CANVAS_SCALE)));
  }

  function zoomCanvas(delta) {
    setCanvasScaleClamped(canvasScale + delta);
  }

  function resetCanvasScale() {
    setCanvasScale(1);
  }

  function focusViewportOnContent() {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const next = computeViewportFocusForNodes(nodes, rect.width, rect.height, {
      minScale: MIN_CANVAS_SCALE,
      maxScale: MAX_CANVAS_SCALE,
    });

    setCanvasScaleClamped(next.scale);
    setViewportOffset({ x: next.offsetX, y: next.offsetY });
  }

  function getStagePoint(event) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: (event.clientX - rect.left - viewportOffset.x) / canvasScale,
      y: (event.clientY - rect.top - viewportOffset.y) / canvasScale,
    };
  }

  function updateActiveCanvas(updater) {
    setDocuments((prev) => {
      const next = prev.map((doc) => {
        if (doc.id !== activeCanvasId) return doc;
        const updated = updater(doc);
        return { ...updated, updatedAt: Date.now() };
      });
      documentsRef.current = next;
      return next;
    });
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
    const centerX = rect
      ? (rect.width / 2 - viewportOffset.x) / canvasScale - DEFAULT_NODE_WIDTH / 2
      : 220;
    const centerY = rect
      ? (rect.height / 2 - viewportOffset.y) / canvasScale - DEFAULT_NODE_HEIGHT / 2
      : 160;
    const node = createNode(type, centerX + Math.random() * 80 - 40, centerY + Math.random() * 80 - 40);

    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: [...doc.nodes, node],
    }));
    setSelectedNodeIds([node.id]);
    setSelectedConnectionId(null);
    setEnlargedTextEdit(null);
  }

  function openEnlargedTextEdit(nodeId, field = 'content') {
    setEnlargedTextEdit({ nodeId, field });
  }

  function closeEnlargedTextEdit() {
    setEnlargedTextEdit(null);
  }

  function openImagePreview(images, index = 0, title = '图片预览') {
    const list = Array.isArray(images) ? images.filter(Boolean) : [];
    if (list.length === 0) return;
    setImagePreview({
      images: list,
      index: Math.min(Math.max(index, 0), list.length - 1),
      title,
    });
  }

  function closeImagePreview() {
    setImagePreview(null);
  }

  function openVideoPreview(videoUrl, title = '视频预览') {
    if (!videoUrl) return;
    setVideoPreview({ videoUrl, title });
  }

  function closeVideoPreview() {
    setVideoPreview(null);
  }

  async function handleDownloadVideo(videoUrl, title = 'video') {
    const safeName = String(title || 'video')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim();
    try {
      await downloadVideoFile(videoUrl, `${safeName || 'video'}.mp4`);
      showCopyNotice('视频下载已开始');
    } catch (error) {
      showCopyNotice(error?.message || '视频下载失败');
    }
  }

  function showCopyNotice(message) {
    setCopyNotice(message);
    if (copyNoticeTimerRef.current) {
      clearTimeout(copyNoticeTimerRef.current);
    }
    copyNoticeTimerRef.current = window.setTimeout(() => setCopyNotice(''), 2200);
  }

  function copyNode(nodeId) {
    const canvasId = activeCanvasIdRef.current;
    const doc =
      documentsRef.current.find((item) => item.id === canvasId) || documentsRef.current[0];
    const node = doc?.nodes?.find((item) => item.id === nodeId);
    if (!node) return false;

    copiedNodeRef.current = JSON.parse(JSON.stringify(node));
    pasteGenerationRef.current = 0;
    setSelectedNodeIds([node.id]);
    setSelectedConnectionId(null);
    return true;
  }

  function duplicateNodeById(nodeId) {
    if (!copyNode(nodeId)) return false;
    if (!pasteCopiedNode()) return false;
    showCopyNotice('已复制节点');
    return true;
  }

  function pasteCopiedNode() {
    const source = copiedNodeRef.current;
    if (!source) return false;

    pasteGenerationRef.current += 1;
    const step = 28;
    const offset = step * pasteGenerationRef.current;
    const node = duplicateNode(source, offset, offset);

    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: [...doc.nodes, node],
    }));
    setSelectedNodeIds([node.id]);
    setSelectedConnectionId(null);
    setEnlargedTextEdit(null);
    return true;
  }

  function updateNode(nodeId, patch) {
    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    }));
  }

  function syncMediaNodeOutputLayout(nodeId, nodeType, layout) {
    const width = layout.width;
    const height = layout.height;
    const outputAspectCss = layout.outputAspectCss || layout.cssAspectRatio;

    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.map((node) => {
        if (node.id !== nodeId || node.type !== nodeType) return node;
        if (node.width === width && node.height === height && node.outputAspectCss === outputAspectCss) {
          return node;
        }

        return {
          ...node,
          width,
          height,
          outputAspectCss,
        };
      }),
    }));
  }

  function syncImageNodeOutputLayout(nodeId, layout) {
    syncMediaNodeOutputLayout(nodeId, 'image', layout);
  }

  function syncVideoNodeOutputLayout(nodeId, layout) {
    syncMediaNodeOutputLayout(nodeId, 'video', layout);
  }

  function updateNodeInCanvas(canvasId, nodeId, patch) {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id !== canvasId) return doc;
        return {
          ...doc,
          updatedAt: Date.now(),
          nodes: doc.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
        };
      })
    );
  }

  function getNodeFromDocuments(canvasId, nodeId) {
    const doc = documentsRef.current.find((item) => item.id === canvasId);
    return doc?.nodes?.find((node) => node.id === nodeId) || null;
  }

  useEffect(() => {
    if (!hydrationDone || recoveryStartedRef.current) return undefined;
    recoveryStartedRef.current = true;

    const token = getStoredChatToken();
    if (!token) return undefined;

    const recovered = recoverPendingTasks(documentsRef.current, ({ canvasId, node, kind }) => {
      const taskKey = recoverTaskKey(canvasId, node);
      if (recoveredTaskKeysRef.current.has(taskKey)) return;
      recoveredTaskKeysRef.current.add(taskKey);

      (async () => {
        setRunningNodeId(node.id);
        const getNode = () => getNodeFromDocuments(canvasId, node.id) || node;
        const updateNodeForCanvas = (nodeId, patch) => updateNodeInCanvas(canvasId, nodeId, patch);

        try {
          if (kind === 'video') {
            await executeVideoGeneration(getNode(), {
              token,
              updateNode: updateNodeForCanvas,
              createVideoGenerationTask,
              normalizeVideoModelSettings,
              inferVideoFamily,
              onPersist: flushPersist,
            });
          } else {
            await executeImageGeneration(getNode(), {
              token,
              updateNode: updateNodeForCanvas,
              createImageGenerationTask,
              normalizeImageModelSettings,
              onPersist: flushPersist,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '任务恢复失败';
          updateNodeInCanvas(canvasId, node.id, {
            content: message,
            status: 'error',
            imageTaskId: undefined,
            videoTaskId: undefined,
            generationBatch: undefined,
            generationJob: undefined,
            pendingTasks: undefined,
          });
          flushPersist();
        } finally {
          setRunningNodeId((current) => (current === node.id ? null : current));
          refreshUserQuota();
        }
      })();
    });

    if (recovered > 0) {
      setStorageNotice((prev) =>
        prev && !prev.includes('恢复') ? prev : `已恢复 ${recovered} 个进行中的生成任务`
      );
    }

    return undefined;
  }, [hydrationDone]);

  function getOrRequestToken() {
    let token = getStoredChatToken();
    if (!token && typeof window !== 'undefined') {
      const input = window.prompt('请输入 Jimiaigo 的 token');
      if (input) {
        token = String(input).trim();
        window.localStorage.setItem(JIMIAIGO_TOKEN_STORAGE_KEY, token);
        refreshUserQuota();
      }
    }
    return token;
  }

  function removeNodes(nodeIds) {
    const idSet = new Set(nodeIds.filter(Boolean));
    if (idSet.size === 0) return;

    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.filter((node) => !idSet.has(node.id)),
      connections: doc.connections.filter(
        (link) => !idSet.has(link.fromNodeId) && !idSet.has(link.toNodeId)
      ),
    }));

    setSelectedNodeIds((prev) => prev.filter((id) => !idSet.has(id)));

    if (enlargedTextEdit && idSet.has(enlargedTextEdit.nodeId)) {
      setEnlargedTextEdit(null);
    }
    if (selectedConnectionId) {
      const selectedLink = connections.find((link) => link.id === selectedConnectionId);
      if (
        selectedLink &&
        (idSet.has(selectedLink.fromNodeId) || idSet.has(selectedLink.toNodeId))
      ) {
        setSelectedConnectionId(null);
      }
    }
    if (linkFromNodeId && idSet.has(linkFromNodeId)) {
      clearLinkDraft();
    }
    if (inputHighlightNodeId && idSet.has(inputHighlightNodeId)) {
      setInputHighlightNodeId(null);
    }
  }

  function removeNode(nodeId) {
    removeNodes([nodeId]);
  }

  function removeConnection(connectionId) {
    updateActiveCanvas((doc) => ({
      ...doc,
      connections: doc.connections.filter((link) => link.id !== connectionId),
    }));
    if (selectedConnectionId === connectionId) {
      setSelectedConnectionId(null);
    }
    if (inputHighlightNodeId) {
      const removed = connections.find((link) => link.id === connectionId);
      if (removed?.toNodeId === inputHighlightNodeId) {
        const stillHasIncoming = connections.some(
          (link) => link.id !== connectionId && link.toNodeId === inputHighlightNodeId
        );
        if (!stillHasIncoming) {
          setInputHighlightNodeId(null);
        }
      }
    }
  }

  function removeTextReference(connectionId) {
    removeConnection(connectionId);
  }

  function highlightNodeInputs(nodeId) {
    setInputHighlightNodeId(nodeId);
    setSelectedConnectionId(null);
  }

  function selectNode(nodeId, options = {}) {
    const { additive = false } = options;
    setSelectedConnectionId(null);

    setSelectedNodeIds((prev) => {
      if (additive) {
        return prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId];
      }
      if (prev.includes(nodeId) && prev.length > 1) {
        return prev;
      }
      return [nodeId];
    });

    const node = nodes.find((item) => item.id === nodeId);
    if (node?.type !== 'image') {
      setInputHighlightNodeId(null);
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
      setSelectedNodeIds([node.id]);
      if (mode !== 'translate-en') {
        openEnlargedTextEdit(node.id, 'content');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      updateNode(node.id, { content: message, status: 'error' });
      setSelectedNodeIds([node.id]);
      setEnlargedTextEdit(null);
    } finally {
      if (mode === 'translate-en') {
        setTranslatingNodeId(null);
      } else {
        setRunningNodeId(null);
      }
      refreshUserQuota();
    }
  }

  async function runImageGeneration(node, mode = 'generate') {
    const promptText = resolveImagePrompt(node, nodes, connections);
    if (!promptText) {
      updateNode(node.id, { content: '图片提示词不能为空，请填写提示词或连接文本节点', status: 'error' });
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
        setSelectedNodeIds([node.id]);
      } catch (error) {
        const message = error instanceof Error ? error.message : '翻译失败';
        updateNode(node.id, { content: message, status: 'error' });
        setSelectedNodeIds([node.id]);
      } finally {
        setTranslatingNodeId(null);
      }
      return;
    }

    setRunningNodeId(node.id);
    recoveredTaskKeysRef.current.delete(recoverTaskKey(activeCanvasId, node));

    try {
      const currentNode = getNodeFromDocuments(activeCanvasId, node.id) || node;
      await executeImageGeneration(
        { ...currentNode, prompt: resolveImagePrompt(currentNode, nodes, connections) },
        {
          token,
          updateNode,
          createImageGenerationTask,
          normalizeImageModelSettings,
          onPersist: flushPersist,
        }
      );
      setSelectedNodeIds([node.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片生成失败';
      updateNode(node.id, {
        content: message,
        status: 'error',
        generationBatch: undefined,
        imageTaskId: undefined,
        pendingTasks: undefined,
        generationJob: undefined,
      });
      setSelectedNodeIds([node.id]);
      flushPersist();
    } finally {
      setRunningNodeId(null);
      refreshUserQuota();
    }
  }

  async function runVideoGeneration(node, mode = 'generate') {
    const promptText = resolveVideoPrompt(node, nodes, connections);
    if (!promptText) {
      updateNode(node.id, { content: '视频提示词不能为空，请填写提示词或连接文本节点', status: 'error' });
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
          content: `Detect whether the following video prompt is primarily Chinese or English. If it is Chinese, translate it into natural English. If it is English, translate it into natural Chinese. Return only the translation, with no explanations:\n\n${promptText}`,
        });
        updateNode(node.id, { prompt: translated, status: 'idle' });
        setSelectedNodeIds([node.id]);
      } catch (error) {
        const message = error instanceof Error ? error.message : '翻译失败';
        updateNode(node.id, { content: message, status: 'error' });
        setSelectedNodeIds([node.id]);
      } finally {
        setTranslatingNodeId(null);
      }
      return;
    }

    setRunningNodeId(node.id);
    recoveredTaskKeysRef.current.delete(recoverTaskKey(activeCanvasId, node));

    try {
      const currentNode = getNodeFromDocuments(activeCanvasId, node.id) || node;
      await executeVideoGeneration(
        {
          ...currentNode,
          prompt: resolveVideoPrompt(currentNode, nodes, connections),
          referenceImages: resolveVideoReferenceImages(currentNode, nodes, connections),
        },
        {
          token,
          updateNode,
          createVideoGenerationTask,
          normalizeVideoModelSettings,
          inferVideoFamily,
          onPersist: flushPersist,
        }
      );
      setSelectedNodeIds([node.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '视频生成失败';
      updateNode(node.id, {
        content: message,
        status: 'error',
        generationBatch: undefined,
        videoTaskId: undefined,
        pendingTasks: undefined,
        generationJob: undefined,
      });
      setSelectedNodeIds([node.id]);
      flushPersist();
    } finally {
      setRunningNodeId(null);
      refreshUserQuota();
    }
  }

  function getAssetPickerMeta(node, pickMode = 'reference') {
    if (pickMode === 'veo-first') {
      return { maxCount: 1, title: '资产库', subtitle: '选择首帧图片' };
    }
    if (pickMode === 'veo-last') {
      return { maxCount: 1, title: '资产库', subtitle: '选择尾帧图片（可选）' };
    }
    if (pickMode === 'veo-reference') {
      const currentCount = Array.isArray(node?.referenceImages) ? node.referenceImages.length : 0;
      return {
        maxCount: Math.max(1, VEO_REFERENCE_IMAGE_MAX - currentCount),
        title: '资产库',
        subtitle: `选择参考图（最多 ${VEO_REFERENCE_IMAGE_MAX} 张）`,
      };
    }
    if (pickMode === 'output') {
      const maxOutput = Math.min(4, Math.max(1, Number(node?.imageCount) || 1));
      return {
        maxCount: maxOutput,
        title: '资产库',
        subtitle: `选择输出图片（最多 ${maxOutput} 张）`,
      };
    }
    return { maxCount: 5, title: '资产库', subtitle: '选择图片作为参考图' };
  }

  function applyPickedAssetsToNode(node, pickMode, pickedAssets, source) {
    const normalized = pickedAssets.map((asset) => ({
      id: asset.id,
      name: asset.name || '图片资产',
      url: source === 'local' ? asset.url : normalizeImageUrl(asset.url),
      source,
      type: 'image',
    }));

    if (pickMode === 'veo-first') {
      return { ...node, videoFirstFrame: normalized[0] || null, status: 'idle' };
    }
    if (pickMode === 'veo-last') {
      if (!node.videoFirstFrame) return node;
      return { ...node, videoLastFrame: normalized[0] || null, status: 'idle' };
    }
    if (pickMode === 'veo-reference') {
      const current = Array.isArray(node.referenceImages) ? node.referenceImages : [];
      return {
        ...node,
        referenceImages: [...current, ...normalized].slice(0, VEO_REFERENCE_IMAGE_MAX),
        status: 'idle',
      };
    }
    if (pickMode === 'output') {
      const urls = normalized.map((asset) => asset.url).filter(Boolean);
      if (urls.length === 0) return node;
      return {
        ...node,
        images: urls,
        content: urls[0],
        status: 'idle',
        imageTaskId: undefined,
        pendingTasks: undefined,
        generationJob: undefined,
        generationBatch: undefined,
        taskStatus: undefined,
        taskProgress: undefined,
        ...buildImageNodeLayoutPatch({
          imageRatio: node.imageRatio,
          imageCount: urls.length,
        }),
      };
    }

    const current = Array.isArray(node.referenceImages) ? node.referenceImages : [];
    return {
      ...node,
      referenceImages: [...current, ...normalized].slice(0, 5),
      status: 'idle',
    };
  }

  async function uploadImageReferences(nodeId, files, pickMode = 'reference') {
    const token = getOrRequestToken();
    if (!token) {
      updateNode(nodeId, { content: '缺少 token', status: 'error' });
      return;
    }

    const node = nodes.find((item) => item.id === nodeId);
    if (pickMode === 'veo-last' && !node?.videoFirstFrame) {
      return;
    }
    const { maxCount } = getAssetPickerMeta(node, pickMode);

    setUploadingNodeId(nodeId);
    try {
      const references = [];
      for (const file of files.slice(0, maxCount)) {
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
        nodes: doc.nodes.map((item) => {
          if (item.id !== nodeId) return item;
          return applyPickedAssetsToNode(item, pickMode, references, 'local');
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

  function openAssetLibrary(nodeId, pickMode = 'reference') {
    const node = nodes.find((item) => item.id === nodeId);
    if (pickMode === 'veo-last' && !node?.videoFirstFrame) {
      return;
    }
    const meta = getAssetPickerMeta(node, pickMode);
    setAssetPicker({
      nodeId,
      pickMode,
      maxCount: meta.maxCount,
      title: meta.title,
      subtitle: meta.subtitle,
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
      if (current.selectedAssets.length >= current.maxCount) return current;
      return {
        ...current,
        selectedAssets: [...current.selectedAssets, asset],
      };
    });
  }

  function confirmAssetSelection() {
    const { nodeId, selectedAssets, pickMode, source } = assetPicker;
    if (!nodeId || selectedAssets.length === 0) return;

    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        return applyPickedAssetsToNode(node, pickMode, selectedAssets, source);
      }),
    }));

    setAssetPicker((current) => ({ ...current, nodeId: null, selectedAssets: [] }));
  }

  function removeVeoFrame(nodeId, slot) {
    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        if (slot === 'first') return { ...node, videoFirstFrame: null, videoLastFrame: null };
        if (slot === 'last') return { ...node, videoLastFrame: null };
        return node;
      }),
    }));
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
    setLinkNodePicker(null);
  }

  function closeLinkNodePicker() {
    setLinkNodePicker(null);
    setLinkFromNodeId(null);
    setHoverLinkNodeId(null);
  }

  function clearSelection() {
    setSelectedNodeIds([]);
    setSelectedConnectionId(null);
    setEnlargedTextEdit(null);
    setLinkFromNodeId(null);
    setHoverLinkNodeId(null);
    setLinkNodePicker(null);
    setInputHighlightNodeId(null);
    setImagePreview(null);
    setVideoPreview(null);
  }

  function finishLink(targetNodeId) {
    if (!linkFromNodeId || linkFromNodeId === targetNodeId) {
      clearLinkDraft();
      return;
    }

    appendConnection(linkFromNodeId, targetNodeId);
    clearLinkDraft();
  }

  function appendConnection(fromNodeId, toNodeId) {
    if (!fromNodeId || fromNodeId === toNodeId) return;

    updateActiveCanvas((doc) => {
      const exists = doc.connections.some(
        (link) => link.fromNodeId === fromNodeId && link.toNodeId === toNodeId
      );

      if (exists) return doc;

      return {
        ...doc,
        connections: [
          ...doc.connections,
          {
            id: uid('link'),
            fromNodeId,
            toNodeId,
          },
        ],
      };
    });
  }

  function createLinkedNode(type) {
    if (!linkNodePicker) return;

    const { fromNodeId, canvasX, canvasY } = linkNodePicker;
    const node = createNode(type, canvasX, canvasY);
    const positionedNode = {
      ...node,
      x: canvasX,
      y: canvasY - node.height / 2,
    };

    updateActiveCanvas((doc) => {
      const exists = doc.connections.some(
        (link) => link.fromNodeId === fromNodeId && link.toNodeId === positionedNode.id
      );

      return {
        ...doc,
        nodes: [...doc.nodes, positionedNode],
        connections: exists
          ? doc.connections
          : [
              ...doc.connections,
              {
                id: uid('link'),
                fromNodeId,
                toNodeId: positionedNode.id,
              },
            ],
      };
    });

    setSelectedNodeIds([positionedNode.id]);
    setSelectedConnectionId(null);
    setEnlargedTextEdit(null);
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

    const pan = panRef.current;
    if (pan) {
      setViewportOffset({
        x: pan.originX + (event.clientX - pan.startX),
        y: pan.originY + (event.clientY - pan.startY),
      });
      return;
    }

    const resize = resizeRef.current;
    if (resize) {
      const dx = (event.clientX - resize.startX) / canvasScale;
      const dy = (event.clientY - resize.startY) / canvasScale;
      const { width, height } = clampNoteSize(resize.originWidth + dx, resize.originHeight + dy);
      updateNode(resize.nodeId, { width, height });
      return;
    }

    const drag = dragRef.current;
    if (drag) {
      const dx = (event.clientX - drag.startX) / canvasScale;
      const dy = (event.clientY - drag.startY) / canvasScale;

      updateActiveCanvas((doc) => ({
        ...doc,
        nodes: doc.nodes.map((node) => {
          const origin = drag.origins[node.id];
          if (!origin) return node;
          return {
            ...node,
            x: origin.x + dx,
            y: origin.y + dy,
          };
        }),
      }));
      return;
    }

    const marquee = marqueeRef.current;
    if (!marquee) return;

    marquee.currentX = point.x;
    marquee.currentY = point.y;

    const moved =
      Math.abs(marquee.currentX - marquee.startX) > 4 ||
      Math.abs(marquee.currentY - marquee.startY) > 4;

    if (moved && !marquee.active) {
      marquee.active = true;
    }

    if (marquee.active) {
      setSelectionMarquee({
        startX: marquee.startX,
        startY: marquee.startY,
        currentX: marquee.currentX,
        currentY: marquee.currentY,
      });
    }
  }

  function handleStagePointerUp(event) {
    const marquee = marqueeRef.current;
    if (marquee) {
      const rect = normalizeSelectionRect(
        marquee.startX,
        marquee.startY,
        marquee.currentX,
        marquee.currentY
      );

      if (marquee.active) {
        const hits = getNodesInSelectionRect(nodes, rect, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT);
        if (marquee.additive) {
          setSelectedNodeIds((prev) => {
            const next = new Set(prev);
            hits.forEach((node) => next.add(node.id));
            return [...next];
          });
        } else {
          setSelectedNodeIds(hits.map((node) => node.id));
        }
        setSelectedConnectionId(null);
        setInputHighlightNodeId(null);
      } else if (!marquee.additive) {
        setSelectedNodeIds([]);
        setSelectedConnectionId(null);
        setEnlargedTextEdit(null);
        setInputHighlightNodeId(null);
      }

      marqueeRef.current = null;
      setSelectionMarquee(null);
    }

    dragRef.current = null;
    resizeRef.current = null;
    panRef.current = null;
    setIsPanning(false);
    setIsResizing(false);
    if (linkFromNodeId) {
      const target = getNodeAtPointer(event, linkFromNodeId);
      if (target) {
        finishLink(target.id);
      } else {
        const point = getStagePoint(event);
        if (point) {
          setLinkNodePicker({
            fromNodeId: linkFromNodeId,
            canvasX: point.x,
            canvasY: point.y,
            screenX: event.clientX,
            screenY: event.clientY,
          });
        } else {
          clearLinkDraft();
        }
      }
    }
  }

  function beginDrag(event, node) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedConnectionId(null);
    resizeRef.current = null;
    marqueeRef.current = null;
    setSelectionMarquee(null);

    const dragNodeIds =
      selectedNodeIds.includes(node.id) && selectedNodeIds.length > 1
        ? selectedNodeIds
        : [node.id];

    if (!selectedNodeIds.includes(node.id)) {
      setSelectedNodeIds([node.id]);
    }

    const origins = {};
    dragNodeIds.forEach((nodeId) => {
      const item = nodes.find((entry) => entry.id === nodeId);
      if (item) {
        origins[nodeId] = { x: item.x, y: item.y };
      }
    });

    dragRef.current = {
      nodeIds: dragNodeIds,
      startX: event.clientX,
      startY: event.clientY,
      origins,
    };
  }

  function beginResize(event, node) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeIds([node.id]);
    setSelectedConnectionId(null);
    dragRef.current = null;
    resizeRef.current = {
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: node.width,
      originHeight: node.height,
    };
    setIsResizing(true);
  }

  function isStageBackgroundTarget(event) {
    const { target, currentTarget } = event;
    if (target === currentTarget) return true;
    if (!(target instanceof Element)) return false;

    if (target.classList.contains('stage-content')) {
      return true;
    }

    return (
      typeof SVGSVGElement !== 'undefined' &&
      target instanceof SVGSVGElement &&
      target.classList.contains('connection-layer')
    );
  }

  function beginPan(event) {
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: viewportOffset.x,
      originY: viewportOffset.y,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleStagePointerDown(event) {
    if (!isStageBackgroundTarget(event)) return;

    setSelectedConnectionId(null);
    setEnlargedTextEdit(null);
    setInputHighlightNodeId(null);
    if (linkNodePicker || linkFromNodeId) clearLinkDraft();

    if (event.button === 1 || spaceKeyRef.current) {
      beginPan(event);
      return;
    }

    if (event.button !== 0) return;

    const point = getStagePoint(event);
    if (!point) return;

    marqueeRef.current = {
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      additive: event.shiftKey,
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function selectConnection(connectionId) {
    setSelectedNodeIds([]);
    setSelectedConnectionId(connectionId);
    setInputHighlightNodeId(null);
    clearLinkDraft();
  }

  function dismissStorageNotice() {
    setStorageNotice('');
  }

  function restoreStorageBackup() {
    const backup = readStorageBackup();
    if (!backup || backup.length === 0) {
      setStorageNotice('未找到可恢复的本地备份');
      return;
    }

    if (!isBackupDifferentFrom(documentsRef.current)) {
      dismissStorageNotice();
      return;
    }

    documentsRef.current = backup;
    setDocuments(backup);
    setActiveCanvasId(backup[0].id);
    setSelectedNodeIds([]);
    setSelectedConnectionId(null);
    setEnlargedTextEdit(null);
    clearLinkDraft();
    writeStorage(backup);
    dismissStorageNotice();
    void flushPersist();
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
        setSelectedNodeIds([]);
        setSelectedConnectionId(null);
        setEnlargedTextEdit(null);
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
        onAddNode={addNode}
        onImport={triggerImport}
        onExport={exportJson}
      />

      {showCanvasPanel ? (
        <>
          <div
            className="canvas-panel-backdrop"
            onPointerDown={() => setShowCanvasPanel(false)}
            aria-hidden="true"
          />
          <CanvasPanel
            documents={documents}
            activeCanvasId={activeCanvasId}
            onCreateCanvas={createCanvas}
            onSelectCanvas={selectCanvas}
            onDeleteCanvas={deleteCanvas}
            onRestoreBackup={restoreStorageBackup}
            hasStorageBackup={hasStorageBackup() && isBackupDifferentFrom(documents)}
            onClose={() => setShowCanvasPanel(false)}
          />
        </>
      ) : null}

      {importError ? <div className="toast-error">{importError}</div> : null}
      {copyNotice ? <div className="toast-info toast-copy">{copyNotice}</div> : null}
      {storageNotice ? (
        <div className="toast-info">
          <span>{storageNotice}</span>
          {hasStorageBackup() && isBackupDifferentFrom(documents) ? (
            <button type="button" className="toast-action" onClick={restoreStorageBackup}>
              恢复备份
            </button>
          ) : null}
          <button
            type="button"
            className="toast-dismiss"
            onClick={dismissStorageNotice}
            aria-label="关闭提示"
          >
            ×
          </button>
        </div>
      ) : null}

      {enlargedTextEditNode ? (
        <TextEditModal
          node={enlargedTextEditNode}
          field={enlargedTextEdit.field}
          onUpdateNode={updateNode}
          onClose={closeEnlargedTextEdit}
        />
      ) : null}

      {imagePreview ? (
        <ImagePreviewModal
          images={imagePreview.images}
          activeIndex={imagePreview.index}
          title={imagePreview.title}
          onSelectIndex={(index) => setImagePreview((current) => ({ ...current, index }))}
          onClose={closeImagePreview}
        />
      ) : null}

      {videoPreview ? (
        <VideoPreviewModal
          videoUrl={videoPreview.videoUrl}
          title={videoPreview.title}
          onClose={closeVideoPreview}
        />
      ) : null}

      {showKeyboardShortcuts ? (
        <KeyboardShortcutsModal onClose={() => setShowKeyboardShortcuts(false)} />
      ) : null}

      {showCustomerService ? (
        <CustomerServiceModal
          qrUrl={siteSettings.kefuQrUrl}
          onClose={() => setShowCustomerService(false)}
        />
      ) : null}

      {showRechargeModal ? (
        <RechargeModal
          isOpen={showRechargeModal}
          user={userQuota.profile}
          onClose={() => setShowRechargeModal(false)}
          onSuccess={refreshUserQuota}
        />
      ) : null}

      {linkNodePicker ? (
        <NodeTypePickerPopover
          screenX={linkNodePicker.screenX}
          screenY={linkNodePicker.screenY}
          onSelect={createLinkedNode}
          onClose={closeLinkNodePicker}
        />
      ) : null}

      {assetPicker.nodeId ? (
        <AssetPickerModal
          assets={assetPicker.assets}
          loading={assetPicker.loading}
          source={assetPicker.source}
          search={assetPicker.search}
          selectedAssets={assetPicker.selectedAssets}
          maxCount={assetPicker.maxCount}
          title={assetPicker.title}
          subtitle={assetPicker.subtitle}
          onSourceChange={(source) =>
            setAssetPicker((current) => ({ ...current, source, selectedAssets: [] }))
          }
          onSearchChange={(search) => setAssetPicker((current) => ({ ...current, search }))}
          onToggleAsset={toggleAssetSelection}
          onUploadImages={(files) => uploadImageReferences(assetPicker.nodeId, files, assetPicker.pickMode)}
          onConfirm={confirmAssetSelection}
          onClose={() => setAssetPicker((current) => ({ ...current, nodeId: null }))}
        />
      ) : null}

      <main className="workspace">
        <Topbar
          activeCanvas={activeCanvas}
          siteTitle={siteSettings.title}
          siteSlogan={siteSettings.slogan}
          siteLogoUrl={siteSettings.logoUrl}
          nodesCount={nodes.length}
          connectionsCount={connections.length}
          showCanvasPanel={showCanvasPanel}
          onRenameCanvas={renameCanvas}
          onToggleCanvasPanel={() => setShowCanvasPanel((value) => !value)}
          onOpenKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
          onOpenCustomerService={() => setShowCustomerService(true)}
          cloudSyncStatus={cloudSyncStatus}
          cloudLastSyncedAt={cloudLastSyncedAt}
          quotaVisible={Boolean(getStoredChatToken())}
          quotaLoading={Boolean(getStoredChatToken()) && userQuota.loading}
          quotaRemaining={userQuota.remaining}
          quotaPercentage={userQuota.percentage}
          onRecharge={openRechargeModal}
        />

        <section
          className={`stage ${linkFromNodeId ? 'link-mode' : ''} ${isPanning ? 'is-panning' : ''} ${isResizing ? 'is-resizing' : ''} ${selectionMarquee ? 'is-marquee-selecting' : ''}`}
          ref={stageRef}
          style={{
            '--canvas-scale': canvasScale,
            '--grid-cell': `${CANVAS_GRID_CELL_SIZE}px`,
            '--viewport-x': `${viewportOffset.x}px`,
            '--viewport-y': `${viewportOffset.y}px`,
          }}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerDown={handleStagePointerDown}
        >
          <div className="stage-content">
            <ConnectionLayer
              nodes={nodes}
              connections={connections}
              selectedConnectionId={selectedConnectionId}
              highlightedConnectionIds={highlightedConnectionIds}
              linkFromNodeId={linkFromNodeId}
              pointerPos={pointerPos}
              onSelectConnection={selectConnection}
            />

            {selectionMarquee ? (
              <div
                className="selection-marquee"
                style={{
                  left: `${Math.min(selectionMarquee.startX, selectionMarquee.currentX)}px`,
                  top: `${Math.min(selectionMarquee.startY, selectionMarquee.currentY)}px`,
                  width: `${Math.abs(selectionMarquee.currentX - selectionMarquee.startX)}px`,
                  height: `${Math.abs(selectionMarquee.currentY - selectionMarquee.startY)}px`,
                }}
              />
            ) : null}

            {orderedNodes.map((node) => (
              <CanvasNode
                key={node.id}
                node={node}
                isSelected={selectedNodeIds.includes(node.id)}
                showToolbar={selectedNodeIds.length === 1 && selectedNodeIds[0] === node.id}
                isRunning={isNodeActivelyRunning(node, runningNodeId)}
                isTranslating={translatingNodeId === node.id}
                textInputLinks={
                  node.type === 'image' || node.type === 'video'
                    ? getTextInputLinks(node.id, nodes, connections)
                    : []
                }
                imageInputLinks={
                  node.type === 'video' ? getImageInputLinks(node.id, nodes, connections) : []
                }
                isInputsHighlighted={inputHighlightNodeId === node.id}
                linkFromNodeId={linkFromNodeId}
                onSelectNode={selectNode}
                onClearConnectionSelection={() => setSelectedConnectionId(null)}
                onBeginDrag={beginDrag}
                onBeginResize={beginResize}
                onOpenTextEdit={openEnlargedTextEdit}
                onCopyNode={duplicateNodeById}
                onUpdateNode={updateNode}
                onRemoveNode={removeNode}
                onRunTextGeneration={runTextGeneration}
                onRunImageGeneration={runImageGeneration}
                onRunVideoGeneration={runVideoGeneration}
                onOpenAssetLibrary={openAssetLibrary}
                onRemoveImageReference={removeImageReference}
                onRemoveTextReference={removeTextReference}
                onHighlightInputs={highlightNodeInputs}
                onPreviewImage={(images, index) =>
                  openImagePreview(images, index, node.title || '图片预览')
                }
                onPreviewVideo={(videoUrl, title) => openVideoPreview(videoUrl, title)}
                onDownloadVideo={handleDownloadVideo}
                onSyncImageOutputLayout={syncImageNodeOutputLayout}
                onSyncVideoOutputLayout={syncVideoNodeOutputLayout}
                onRemoveVeoFrame={removeVeoFrame}
                onPortPointerDown={handlePortPointerDown}
                onFinishLink={finishLink}
              />
            ))}
          </div>

          {showFocusContentPrompt ? (
            <FocusContentPrompt nodeCount={nodes.length} onFocus={focusViewportOnContent} />
          ) : null}

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
