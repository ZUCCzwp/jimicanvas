import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AssetPickerModal } from './components/AssetPickerModal';
import { SeedanceAssetPickerModal } from './components/SeedanceAssetPickerModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { VideoPreviewModal } from './components/VideoPreviewModal';
import { NodeTypePickerPopover } from './components/NodeTypePickerPopover';
import { TextEditModal } from './components/TextEditModal';
import { NodeSettingsModal } from './components/NodeSettingsModal';
import { CanvasNode } from './components/CanvasNode';
import { CanvasZoomControls } from './components/CanvasZoomControls';
import { CanvasBackgroundPicker } from './components/CanvasBackgroundPicker';
import { CanvasMinimap } from './components/CanvasMinimap';
import { FocusContentPrompt } from './components/FocusContentPrompt';
import { ConnectionLayer } from './components/ConnectionLayer';
import { FloatingDock } from './components/FloatingDock';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CustomerServiceModal } from './components/CustomerServiceModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { RechargeModal } from './components/RechargeModal';
import { Topbar } from './components/Topbar';
import { WorkflowTemplateModal } from './components/WorkflowTemplateModal';
import { useTheme } from './hooks/useTheme';
import { navigateToCanvasHome } from './lib/appNavigation';
import { normalizeCanvasBackground } from './lib/canvasBackground';
import { isEditableKeyboardTarget } from './lib/keyboardShortcuts';
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
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
  SEEDANCE_REF_IMAGE_MAX,
  SEEDANCE_REF_VIDEO_MAX,
  SEEDANCE_REF_AUDIO_MAX,
  VIDEO_GENERIC_REFERENCE_MAX,
  getImageReferenceMax,
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
  getVideoInputLinks,
  isImageToPromptNode,
  isVideoToPromptNode,
  resolveNoteImageInputUrls,
  resolveNoteVideoInputUrls,
  resolveImagePrompt,
  resolveVideoPrompt,
  resolveAudioPrompt,
  resolveVideoReferenceImages,
  resolveImageReferenceImages,
} from './lib/connections';
import { createSpeech, normalizeAudioUrl, filterAudioFiles, isAudioFile, isAudioAssetRecord } from './lib/audioApi';
import {
  applyCanvasVersions,
  deleteCanvasDocument,
  fetchCanvasDocuments,
  parseCloudDocuments,
  saveCanvasDocument,
  saveCanvasDocumentKeepalive,
  saveCanvasDocuments,
} from './lib/canvasApi';
import { getOrRequestToken, getStoredChatToken, runChatCompletion } from './lib/chatApi';
import { isBackendInCooldown } from './lib/jimiaigoApi';
import { fetchUserInfo } from './lib/userApi';
import { fetchSiteConfig, getDefaultSiteSettings } from './lib/siteApi';
import {
  buildImageDownloadFilename,
  createImageGenerationTask,
  downloadImageFile,
  getAssetList,
  normalizeImageUrl,
  uploadAsset,
  splitImageIntoGridBlobs,
  understandImage,
  DEFAULT_IMAGE_TO_PROMPT_INSTRUCTION,
  formatImageUnderstandingResult,
} from './lib/imageApi';
import { buildStructuredTranslateInstruction, formatStructuredPromptResult } from './lib/promptStructured';
import { buildImageNodeLayoutPatch, collectImageNodeOutputUrls, computeSplitImageNodePositions, filterRealImageOutputs, formatCellAspectRatio, resolveImageOutputLayout } from './lib/imageNodeLayout';
import { buildVideoNodeLayoutPatch } from './lib/videoNodeLayout';
import {
  executeImageGeneration,
  executeVideoGeneration,
  isNodeActivelyRunning,
  mergeDocumentsPreservePending,
  recoverPendingTasks,
  recoverTaskKey,
} from './lib/generationResume';
import {
  clearPendingCanvasIntent,
  loadInitialState,
  readPendingCanvasId,
  readPendingNewCanvas,
  readPendingWorkflowTemplate,
  sanitizeDocumentsForPersist,
  writeActiveCanvasId,
  writeStorage,
} from './lib/storage';
import {
  createVideoGenerationTask,
  downloadVideoFile,
  formatVideoUnderstandingResult,
  getSd2ManxueAssetList,
  normalizeVideoUrl,
  resolveSeedanceMediaPreviewUrl,
  understandVideo,
  DEFAULT_VIDEO_TO_PROMPT_INSTRUCTION,
  uploadAndAuditSeedanceAssets,
} from './lib/videoApi';
import {
  buildWorkflowTemplateFragment,
  getWorkflowTemplateDefaultName,
  createWorkflowTemplateDocument,
} from './lib/workflowTemplates';

function App() {
  const { theme, toggleTheme } = useTheme();
  const needsCloudHydrate = useMemo(() => Boolean(getStoredChatToken()), []);
  const initial = useMemo(() => loadInitialState(), []);
  const [documents, setDocuments] = useState(initial.documents);
  const [storageNotice, setStorageNotice] = useState(() => {
    if (initial.loadedFrom === 'backup') {
      return '已从本地备份恢复画布';
    }
    if (initial.loadedFrom === 'primary' && initial.documents.length > 0) {
      return '已加载本地缓存画布，正在同步云端…';
    }
    return '';
  });
  const [activeCanvasId, setActiveCanvasId] = useState(initial.activeCanvasId);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectionMarquee, setSelectionMarquee] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [enlargedTextEdit, setEnlargedTextEdit] = useState(null);
  const [enlargedNodeSettings, setEnlargedNodeSettings] = useState(null);
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
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showCustomerService, setShowCustomerService] = useState(false);
  const [workflowTemplateOpen, setWorkflowTemplateOpen] = useState(false);
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
    seedanceStatus: 'Active',
    seedanceAuditing: false,
    seedanceNotice: '',
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
  const cloudMetaVersionRef = useRef(0);
  const cloudCanvasVersionsRef = useRef({});
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
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false);
  const [hydrationDone, setHydrationDone] = useState(false);
  const recoveredTaskKeysRef = useRef(new Set());
  const recoveryStartedRef = useRef(false);
  const pendingUrlAppliedRef = useRef(false);
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
    if (isBackendInCooldown()) {
      setUserQuota((prev) => ({ ...prev, loading: false }));
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
      const requested = getOrRequestToken({ onSaved: refreshUserQuota });
      if (!requested) return;
    }
    refreshUserQuota();
    setShowRechargeModal(true);
  }

  const runWithToken = async (action) => {
    let token = getStoredChatToken();
    if (!token) return null;
    try {
      return await action(token);
    } catch (error) {
      if (!error?.isTokenExpired) throw error;
      token = getOrRequestToken({ expired: true, onSaved: refreshUserQuota });
      if (!token) throw error;
      refreshUserQuota();
      return action(token);
    }
  };

  const getActiveDocumentForCloudSave = (docs) => {
    const sanitized = sanitizeDocumentsForPersist(docs);
    const activeId = activeCanvasIdRef.current;
    return sanitized.find((doc) => doc.id === activeId) || sanitized[0] || null;
  };

  const syncCloudVersions = (payload) => {
    applyCanvasVersions(cloudCanvasVersionsRef, payload);
    if (payload?.version != null) {
      cloudMetaVersionRef.current = Number(payload.version) || 0;
    }
  };

  const saveActiveCanvasToCloud = async (token) => {
    const doc = getActiveDocumentForCloudSave(documentsRef.current);
    if (!doc?.id) return null;
    const saved = await saveCanvasDocument(token, doc.id, {
      document: doc,
      version: cloudCanvasVersionsRef.current[doc.id] || 0,
      activeCanvasId: activeCanvasIdRef.current || doc.id,
    });
    syncCloudVersions(saved);
    return saved;
  };

  const flushPersist = async () => {
    const docsToSave = sanitizeDocumentsForPersist(documentsRef.current);
    writeStorage(docsToSave);
    if (docsToSave.length === 0 || skipCloudSaveRef.current) return;
    try {
      await runWithToken(async (token) => {
        await saveActiveCanvasToCloud(token);
        setCloudLastSyncedAt(Date.now());
        setCloudSyncStatus('synced');
      });
    } catch (error) {
      if (error?.isTokenExpired) {
        setCloudSyncStatus('offline');
        setStorageNotice('Token 已过期，请重新输入 AT 后可同步云端');
        return;
      }
      setCloudSyncStatus('pending');
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromCloud() {
      const token = getStoredChatToken();
      if (!token) {
        setCloudSyncStatus('offline');
        setStorageNotice(
          documentsRef.current.length > 0
            ? '未登录，当前使用本地缓存画布'
            : '请登录后使用云端画布'
        );
        cloudSyncReadyRef.current = true;
        skipCloudSaveRef.current = false;
        setHydrationDone(true);
        return;
      }

      setCloudSyncStatus('loading');

      try {
        if (isBackendInCooldown()) {
          throw new Error('无法连接到画布服务');
        }
        await runWithToken(async (authToken) => {
          const cloud = await fetchCanvasDocuments(authToken);
          if (cancelled) return;

          const cloudDocs = parseCloudDocuments(cloud?.documents);
          const sessionDocs = documentsRef.current;

          if (cloudDocs?.length) {
            const nextDocs = sanitizeDocumentsForPersist(
              sessionDocs.length > 0
                ? mergeDocumentsPreservePending(cloudDocs, sessionDocs, {
                    preserveCloudOnlyDocuments: false,
                  })
                : cloudDocs
            );
            const pendingId = readPendingCanvasId();
            const keptPendingActive = pendingId && nextDocs.some((doc) => doc.id === pendingId);
            const nextActiveId = keptPendingActive
              ? pendingId
              : cloud.active_canvas_id && nextDocs.some((doc) => doc.id === cloud.active_canvas_id)
                ? cloud.active_canvas_id
                : nextDocs[0]?.id;
            setDocuments(nextDocs);
            setActiveCanvasId(nextActiveId);
            writeStorage(nextDocs);
            writeActiveCanvasId(nextActiveId);
            syncCloudVersions(cloud);
            setStorageNotice((prev) =>
              prev && !prev.includes('云端') && !prev.includes('本地')
                ? prev
                : '已从云端同步画布'
            );
          } else if (sessionDocs.length > 0) {
            const nextActiveId = activeCanvasIdRef.current || sessionDocs[0]?.id;
            const saved = await saveCanvasDocuments(authToken, {
              documents: sanitizeDocumentsForPersist(sessionDocs),
              activeCanvasId: nextActiveId,
              version: Number(cloud?.version) || 0,
            });
            if (!cancelled) syncCloudVersions(saved);
            writeStorage(sessionDocs);
            writeActiveCanvasId(nextActiveId);
          } else {
            const first = createDocument('画布 1', false);
            const nextDocs = [first];
            setDocuments(nextDocs);
            setActiveCanvasId(first.id);
            writeStorage(nextDocs);
            writeActiveCanvasId(first.id);
            const saved = await saveCanvasDocuments(authToken, {
              documents: sanitizeDocumentsForPersist(nextDocs),
              activeCanvasId: first.id,
              version: Number(cloud?.version) || 0,
            });
            if (!cancelled) syncCloudVersions(saved);
          }
          if (!cancelled) {
            setCloudLastSyncedAt(Date.now());
            setCloudSyncStatus('synced');
          }
        });
      } catch (error) {
        if (!cancelled) {
          if (error?.isTokenExpired) {
            setCloudSyncStatus('offline');
            setStorageNotice('Token 已过期，请重新输入 AT 后可同步云端');
          } else {
            setCloudSyncStatus('error');
            setStorageNotice(
              documentsRef.current.length > 0
                ? '云端加载失败，已使用本地缓存画布'
                : '云端加载失败，请刷新重试'
            );
          }
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
    if (documents.length === 0) return undefined;

    const token = getStoredChatToken();
    if (!token) {
      setCloudSyncStatus('offline');
      return undefined;
    }

    if (isBackendInCooldown()) {
      return undefined;
    }

    setCloudSyncStatus('pending');

    const timer = window.setTimeout(async () => {
      if (isBackendInCooldown()) {
        setCloudSyncStatus('error');
        return;
      }
      setCloudSyncStatus('saving');
      try {
        await runWithToken(async (authToken) => {
          await saveActiveCanvasToCloud(authToken);
          setCloudLastSyncedAt(Date.now());
          setCloudSyncStatus('synced');
        });
      } catch (error) {
        if (error?.isConflict && error.latest) {
          syncCloudVersions(error.latest);
          const latestDocs = parseCloudDocuments(error.latest.documents);
          if (latestDocs?.length) {
            setDocuments((prev) => {
              const merged = sanitizeDocumentsForPersist(
                mergeDocumentsPreservePending(latestDocs, prev, {
                  preserveCloudOnlyDocuments: false,
                })
              );
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
        if (error?.isTokenExpired) {
          setCloudSyncStatus('offline');
          setStorageNotice('Token 已过期，请重新输入 AT 后可同步云端');
          return;
        }
        setCloudSyncStatus('error');
      }
    }, CLOUD_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [documents, activeCanvasId]);

  useEffect(() => {
    if (documents.length === 0) return undefined;
    const result = writeStorage(sanitizeDocumentsForPersist(documents));
    if (!result.ok) {
      setStorageNotice(
        '画布保存到浏览器失败，存储空间可能已满。请尽快导出 JSON，或删除节点里过大的本地图片后再试。'
      );
      return undefined;
    }
    if (storageNotice.startsWith('画布保存到浏览器失败')) {
      setStorageNotice('');
    }
    return undefined;
  }, [documents]);

  useEffect(() => {
    if (activeCanvasId) {
      writeActiveCanvasId(activeCanvasId);
    }
  }, [activeCanvasId]);

  useEffect(() => {
    if (!hydrationDone) return undefined;
    if (!documents.some((doc) => doc.id === activeCanvasId)) {
      setActiveCanvasId(documents[0]?.id || null);
      setSelectedNodeIds([]);
      setSelectedConnectionId(null);
      setEnlargedTextEdit(null);
      setHoverLinkNodeId(null);
    }
  }, [documents, activeCanvasId, hydrationDone]);

  useEffect(() => {
    function persistOnExit() {
      writeStorage(sanitizeDocumentsForPersist(documentsRef.current));
      if (activeCanvasIdRef.current) {
        writeActiveCanvasId(activeCanvasIdRef.current);
      }
      const token = getStoredChatToken();
      if (token && cloudSyncReadyRef.current && !skipCloudSaveRef.current) {
        const doc = getActiveDocumentForCloudSave(documentsRef.current);
        if (doc?.id) {
          saveCanvasDocumentKeepalive(token, doc.id, {
            document: doc,
            version: cloudCanvasVersionsRef.current[doc.id] || 0,
            activeCanvasId: activeCanvasIdRef.current,
          });
        }
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
    if (!assetPicker.nodeId) return;
    if (String(assetPicker.pickMode).startsWith('seedance-')) {
      loadSeedanceAssetPickerAssets(assetPicker.seedanceStatus);
      return;
    }
    loadAssetPickerAssets(assetPicker.source, assetPicker.pickMode);
  }, [
    assetPicker.nodeId,
    assetPicker.source,
    assetPicker.pickMode,
    assetPicker.seedanceStatus,
  ]);

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
  }, [selectedConnectionId, selectedNodeIds, showCustomerService, showKeyboardShortcuts]);

  const activeCanvas = documents.find((doc) => doc.id === activeCanvasId) || documents[0];
  const canvasBackground = normalizeCanvasBackground(activeCanvas?.background);
  const canvasReady = !needsCloudHydrate || hydrationDone;
  const nodes = canvasReady ? activeCanvas?.nodes || [] : [];
  const connections = activeCanvas?.connections || [];
  const primarySelectedNodeId =
    selectedNodeIds.length > 0 ? selectedNodeIds[selectedNodeIds.length - 1] : null;
  const highlightedConnectionIds = useMemo(() => {
    if (!inputHighlightNodeId) return [];
    return connections
      .filter((link) => link.toNodeId === inputHighlightNodeId)
      .map((link) => link.id);
  }, [connections, inputHighlightNodeId]);
  const displaySelectedNodeIds = useMemo(() => {
    if (!selectionMarquee) return selectedNodeIds;

    const rect = normalizeSelectionRect(
      selectionMarquee.startX,
      selectionMarquee.startY,
      selectionMarquee.currentX,
      selectionMarquee.currentY
    );
    if (rect.width < 4 && rect.height < 4) return selectedNodeIds;

    const hits = getNodesInSelectionRect(nodes, rect, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT);
    const hitIds = hits.map((node) => node.id);

    if (selectionMarquee.additive) {
      return [...new Set([...selectedNodeIds, ...hitIds])];
    }
    return hitIds;
  }, [nodes, selectedNodeIds, selectionMarquee]);

  const orderedNodes = useMemo(() => {
    if (displaySelectedNodeIds.length === 0) return nodes;
    const selectedSet = new Set(displaySelectedNodeIds);
    return [
      ...nodes.filter((node) => !selectedSet.has(node.id)),
      ...nodes.filter((node) => selectedSet.has(node.id)),
    ];
  }, [nodes, displaySelectedNodeIds]);
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
  const enlargedSettingsNode =
    enlargedNodeSettings && nodes.find((node) => node.id === enlargedNodeSettings.nodeId);
  const enlargedSettingsNodeType =
    enlargedSettingsNode?.type === 'image' || enlargedSettingsNode?.type === 'video'
      ? enlargedSettingsNode.type
      : null;

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

  function renameCanvas(name) {
    updateActiveCanvas((doc) => ({ ...doc, name }));
  }

  function updateCanvasBackground(background) {
    updateActiveCanvas((doc) => ({
      ...doc,
      background: normalizeCanvasBackground(background),
    }));
  }

  function deleteCanvas(canvasId) {
    const touchedAt = Date.now();

    if (documents.length === 1) {
      const replacement = createDocument('画布 1', false);
      replacement.updatedAt = touchedAt;
      documentsRef.current = [replacement];
      setDocuments([replacement]);
      setActiveCanvasId(replacement.id);
      clearSelection();
      void flushPersist();
      return;
    }

    const next = documents
      .filter((doc) => doc.id !== canvasId)
      .map((doc) => ({ ...doc, updatedAt: touchedAt }));
    documentsRef.current = next;
    setDocuments(next);
    if (canvasId === activeCanvasId) {
      setActiveCanvasId(next[0]?.id || null);
      clearSelection();
    }
    void flushPersist();
  }

  function handleDeleteCurrentProject() {
    if (!activeCanvasId) return;
    setDeleteConfirm({
      canvasId: activeCanvasId,
      name: activeCanvas?.name || '当前项目',
    });
  }

  async function handleConfirmDeleteProject() {
    if (!deleteConfirm?.canvasId || deleteConfirmLoading) return;
    const { canvasId } = deleteConfirm;
    setDeleteConfirmLoading(true);
    try {
      const token = getStoredChatToken();
      if (token) {
        await runWithToken((authToken) => deleteCanvasDocument(authToken, canvasId));
      }
      deleteCanvas(canvasId);
      setDeleteConfirm(null);
    } catch (error) {
      if (!error?.isTokenExpired) {
        setStorageNotice(error?.message || '删除失败，请稍后重试');
      }
    } finally {
      setDeleteConfirmLoading(false);
    }
  }

  useEffect(() => {
    if (!hydrationDone || pendingUrlAppliedRef.current) return undefined;
    pendingUrlAppliedRef.current = true;

    if (readPendingNewCanvas()) {
      const templateId = readPendingWorkflowTemplate();
      clearPendingCanvasIntent();
      const count = documentsRef.current.length + 1;
      const canvas = templateId
        ? createWorkflowTemplateDocument(templateId, getWorkflowTemplateDefaultName(templateId, count))
        : createDocument(`画布 ${count}`, false);
      setDocuments((prev) => {
        const next = [canvas, ...prev];
        writeStorage(next);
        return next;
      });
      setActiveCanvasId(canvas.id);
      clearSelection();
      return undefined;
    }

    const pendingId = readPendingCanvasId();
    if (pendingId) {
      clearPendingCanvasIntent();
      if (documentsRef.current.some((doc) => doc.id === pendingId)) {
        setActiveCanvasId(pendingId);
        clearSelection();
      }
    }

    return undefined;
  }, [hydrationDone]);

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

  function insertWorkflowTemplate(templateId) {
    const rect = stageRef.current?.getBoundingClientRect();
    const centerX = rect
      ? (rect.width / 2 - viewportOffset.x) / canvasScale - 220
      : 220;
    const centerY = rect
      ? (rect.height / 2 - viewportOffset.y) / canvasScale - 120
      : 160;
    const { nodes, connections } = buildWorkflowTemplateFragment(
      templateId,
      centerX + Math.random() * 40 - 20,
      centerY + Math.random() * 40 - 20
    );
    if (!nodes.length) return;

    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: [...doc.nodes, ...nodes],
      connections: [...doc.connections, ...connections],
    }));
    setSelectedNodeIds(nodes.map((node) => node.id));
    setSelectedConnectionId(null);
    setEnlargedTextEdit(null);
    setWorkflowTemplateOpen(false);
  }

  function openEnlargedTextEdit(nodeId, field = 'content') {
    setEnlargedTextEdit({ nodeId, field });
  }

  function closeEnlargedTextEdit() {
    setEnlargedTextEdit(null);
  }

  function openEnlargedNodeSettings(nodeId) {
    setEnlargedNodeSettings({ nodeId });
  }

  function closeEnlargedNodeSettings() {
    setEnlargedNodeSettings(null);
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

  async function handleDownloadImage(images, title = 'image') {
    const list = (Array.isArray(images) ? images : [images]).filter(Boolean);
    if (!list.length) {
      showCopyNotice('没有可下载的图片');
      return;
    }
    try {
      for (let index = 0; index < list.length; index += 1) {
        const url = list[index];
        const filename = buildImageDownloadFilename(title, url, index, list.length);
        await downloadImageFile(url, filename);
      }
      showCopyNotice(list.length > 1 ? `已开始下载 ${list.length} 张图片` : '图片下载已开始');
    } catch (error) {
      showCopyNotice(error?.message || '图片下载失败');
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

  async function handleSplitImageNode(nodeId, imageUrl, cols, rows) {
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    const token = getOrRequestToken({ onSaved: refreshUserQuota });
    if (!token) {
      throw new Error('缺少 token，无法上传切分图片');
    }

    const { blobs, cellWidth, cellHeight } = await splitImageIntoGridBlobs(imageUrl, cols, rows);
    const uploadedUrls = [];

    for (let idx = 0; idx < blobs.length; idx++) {
      const file = new File([blobs[idx]], `split_${idx + 1}.jpg`, { type: 'image/jpeg' });
      const uploadedUrl = await uploadAsset({ token, file });
      const normalizedUrl = normalizeImageUrl(uploadedUrl || '');
      if (!normalizedUrl || normalizedUrl.startsWith('data:')) {
        throw new Error(`第 ${idx + 1} 张切分图上传失败，请重试`);
      }
      uploadedUrls.push(normalizedUrl);
    }

    const splitLayout = buildImageNodeLayoutPatch({
      imageCount: 1,
      aspectWidth: cellWidth,
      aspectHeight: cellHeight,
    });
    const splitRatio = formatCellAspectRatio(cellWidth, cellHeight);
    const positions = computeSplitImageNodePositions({
      originX: targetNode.x,
      originY: targetNode.y,
      originWidth: targetNode.width,
      cols,
      rows,
      nodeWidth: splitLayout.width,
      nodeHeight: splitLayout.height,
    });

    const newNodes = [];

    for (let idx = 0; idx < uploadedUrls.length; idx++) {
      const finalUrl = uploadedUrls[idx];
      const { x, y } = positions[idx];

      const newNode = createNode('image', x, y);
      newNode.title = `${targetNode.title || '图片'}_切分_${idx + 1}`;
      newNode.content = finalUrl;
      newNode.images = [finalUrl];
      newNode.imageCount = 1;
      newNode.imageRatio = splitRatio;
      newNode.prompt = targetNode.prompt;
      newNode.isEntrance = true;
      newNode.width = splitLayout.width;
      newNode.height = splitLayout.height;
      newNode.outputAspectCss = splitLayout.outputAspectCss;
      newNodes.push(newNode);
    }

    for (let idx = 0; idx < newNodes.length; idx++) {
      if (idx > 0) {
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
      updateActiveCanvas((doc) => ({
        ...doc,
        nodes: [...doc.nodes, newNodes[idx]],
      }));
    }

    setSelectedNodeIds(newNodes.map((n) => n.id));

    setTimeout(() => {
      updateActiveCanvas((doc) => ({
        ...doc,
        nodes: doc.nodes.map((n) =>
          newNodes.some((item) => item.id === n.id) ? { ...n, isEntrance: false } : n
        ),
      }));
    }, 1000);

    flushPersist();
  }

  async function handleExplodeImageOutputs(nodeId) {
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    const imageUrls = filterRealImageOutputs(collectImageNodeOutputUrls(targetNode));
    if (imageUrls.length <= 1) {
      showCopyNotice('至少需要 2 张输出图片才能拆分');
      return;
    }

    const layouts = await Promise.all(
      imageUrls.map((url) =>
        resolveImageOutputLayout({
          imageUrls: [url],
          imageRatio: targetNode.imageRatio,
          imageCount: 1,
        })
      )
    );

    const nodeWidth = Math.max(...layouts.map((layout) => layout.width));
    const nodeHeight = Math.max(...layouts.map((layout) => layout.height));
    const cols = Math.min(2, imageUrls.length);
    const rows = Math.ceil(imageUrls.length / cols);
    const positions = computeSplitImageNodePositions({
      originX: targetNode.x,
      originY: targetNode.y,
      originWidth: targetNode.width,
      cols,
      rows,
      nodeWidth,
      nodeHeight,
    });

    const newNodes = imageUrls.map((url, idx) => {
      const layout = layouts[idx];
      const { x, y } = positions[idx];
      const newNode = createNode('image', x, y);
      newNode.title = `${targetNode.title || '图片'}_${idx + 1}`;
      newNode.content = url;
      newNode.images = [url];
      newNode.imageCount = 1;
      newNode.imageRatio = targetNode.imageRatio;
      newNode.imageModel = targetNode.imageModel;
      newNode.imageResolution = targetNode.imageResolution;
      newNode.imageQuality = targetNode.imageQuality;
      newNode.prompt = targetNode.prompt;
      newNode.referenceImages = Array.isArray(targetNode.referenceImages)
        ? [...targetNode.referenceImages]
        : [];
      newNode.isEntrance = true;
      newNode.width = layout.width;
      newNode.height = layout.height;
      newNode.outputAspectCss = layout.outputAspectCss;
      return newNode;
    });

    const firstNewId = newNodes[0]?.id;

    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.filter((node) => node.id !== nodeId).concat(newNodes),
      connections: doc.connections.map((link) => {
        if (link.fromNodeId === nodeId) return { ...link, fromNodeId: firstNewId };
        if (link.toNodeId === nodeId) return { ...link, toNodeId: firstNewId };
        return link;
      }),
    }));

    setSelectedNodeIds(newNodes.map((node) => node.id));

    setTimeout(() => {
      updateActiveCanvas((doc) => ({
        ...doc,
        nodes: doc.nodes.map((node) =>
          newNodes.some((item) => item.id === node.id) ? { ...node, isEntrance: false } : node
        ),
      }));
    }, 1000);

    flushPersist();
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

  function syncAudioNodeOutputLayout(nodeId, layout) {
    syncMediaNodeOutputLayout(nodeId, 'audio', layout);
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
        const getNode = () => {
          const doc = documentsRef.current.find((item) => item.id === canvasId);
          const current = getNodeFromDocuments(canvasId, node.id) || node;
          if (kind !== 'image') return current;
          return {
            ...current,
            referenceImages: resolveImageReferenceImages(
              current,
              doc?.nodes || [],
              doc?.connections || []
            ),
          };
        };
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
    if (enlargedNodeSettings && idSet.has(enlargedNodeSettings.nodeId)) {
      setEnlargedNodeSettings(null);
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
    const imageInputLinks = getImageInputLinks(node.id, nodes, connections);
    const videoInputLinks = getVideoInputLinks(node.id, nodes, connections);
    const videoToPromptMode = isVideoToPromptNode(node, videoInputLinks);
    const imageToPromptMode = !videoToPromptMode && isImageToPromptNode(node, imageInputLinks);
    const connectedVideos = resolveNoteVideoInputUrls(videoInputLinks);
    const connectedImages = resolveNoteImageInputUrls(imageInputLinks);
    const promptText = String(node.prompt || node.content || node.title || '').trim();
    const reversePromptMode = videoToPromptMode || imageToPromptMode;

    if (reversePromptMode && mode === 'translate-structured-en') {
      const sourceContent = String(node.content || '').trim();
      if (!sourceContent || node.status === 'error') {
        updateNode(node.id, { content: '暂无可翻译的反推结果，请先运行反推', status: 'error' });
        return;
      }

      const token = getOrRequestToken({ onSaved: refreshUserQuota });
      if (!token) {
        updateNode(node.id, { content: '缺少 token', status: 'error' });
        return;
      }

      setTranslatingNodeId(node.id);
      try {
        const translated = await runChatCompletion({
          token,
          content: buildStructuredTranslateInstruction(sourceContent),
        });
        const formatted = formatStructuredPromptResult(translated, ['prompt', 'shortPrompt']);
        updateNode(node.id, {
          content: formatted.content,
          prompt: formatted.prompt,
          promptLocale: 'en',
          ...(videoToPromptMode
            ? { videoPromptStructured: formatted.structured }
            : { imagePromptStructured: formatted.structured }),
          status: 'idle',
        });
        setSelectedNodeIds([node.id]);
        openEnlargedTextEdit(node.id, 'content');
      } catch (error) {
        const message = error instanceof Error ? error.message : '翻译失败';
        updateNode(node.id, { content: message, status: 'error' });
        setSelectedNodeIds([node.id]);
        setEnlargedTextEdit(null);
      } finally {
        setTranslatingNodeId(null);
        refreshUserQuota();
      }
      return;
    }

    if (videoToPromptMode && mode === 'generate') {
      if (!connectedVideos.length) {
        updateNode(node.id, {
          content: '请先连接有效视频节点（需上传或生成真实视频，示例视频不可用）',
          status: 'error',
        });
        return;
      }

      const token = getOrRequestToken({ onSaved: refreshUserQuota });
      if (!token) {
        updateNode(node.id, { content: '缺少 token', status: 'error' });
        return;
      }

      setRunningNodeId(node.id);
      try {
        const generated = await understandVideo({
          token,
          videoUrls: connectedVideos.map((item) => item.url),
          promptText: String(node.prompt || '').trim() || DEFAULT_VIDEO_TO_PROMPT_INSTRUCTION,
          language: 'zh',
        });

        const formatted = formatVideoUnderstandingResult(generated);
        updateNode(node.id, {
          content: formatted.content,
          prompt: formatted.prompt,
          videoPromptStructured: formatted.structured,
          promptLocale: formatted.locale || 'zh',
          status: 'idle',
        });
        setSelectedNodeIds([node.id]);
        openEnlargedTextEdit(node.id, 'content');
      } catch (error) {
        const message = error instanceof Error ? error.message : '视频理解失败';
        updateNode(node.id, { content: message, status: 'error' });
        setSelectedNodeIds([node.id]);
        setEnlargedTextEdit(null);
      } finally {
        setRunningNodeId(null);
        refreshUserQuota();
      }
      return;
    }

    if (imageToPromptMode && mode === 'generate') {
      if (!connectedImages.length) {
        updateNode(node.id, {
          content: '请先连接有效图片节点（需上传或生成真实图片，示例图不可用）',
          status: 'error',
        });
        return;
      }

      const token = getOrRequestToken({ onSaved: refreshUserQuota });
      if (!token) {
        updateNode(node.id, { content: '缺少 token', status: 'error' });
        return;
      }

      setRunningNodeId(node.id);
      try {
        const generated = await understandImage({
          token,
          imageUrls: connectedImages.map((item) => item.url),
          promptText: String(node.prompt || '').trim() || DEFAULT_IMAGE_TO_PROMPT_INSTRUCTION,
          language: 'zh',
        });

        const formatted = formatImageUnderstandingResult(generated);
        updateNode(node.id, {
          content: formatted.content,
          prompt: formatted.prompt,
          imagePromptStructured: formatted.structured,
          promptLocale: formatted.locale || 'zh',
          status: 'idle',
        });
        setSelectedNodeIds([node.id]);
        openEnlargedTextEdit(node.id, 'content');
      } catch (error) {
        const message = error instanceof Error ? error.message : '图片理解失败';
        updateNode(node.id, { content: message, status: 'error' });
        setSelectedNodeIds([node.id]);
        setEnlargedTextEdit(null);
      } finally {
        setRunningNodeId(null);
        refreshUserQuota();
      }
      return;
    }

    if (!promptText) {
      updateNode(node.id, { content: '文本节点内容为空', status: 'error' });
      return;
    }

    const token = getOrRequestToken({ onSaved: refreshUserQuota });

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

    const token = getOrRequestToken({ onSaved: refreshUserQuota });

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
        {
          ...currentNode,
          prompt: resolveImagePrompt(currentNode, nodes, connections),
          referenceImages: resolveImageReferenceImages(currentNode, nodes, connections),
        },
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
      void flushPersist();
    }
  }

  async function runVideoGeneration(node, mode = 'generate') {
    const promptText = resolveVideoPrompt(node, nodes, connections);
    if (!promptText) {
      updateNode(node.id, { content: '视频提示词不能为空，请填写提示词或连接文本节点', status: 'error' });
      return;
    }

    const token = getOrRequestToken({ onSaved: refreshUserQuota });

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
      void flushPersist();
    }
  }

  async function runAudioGeneration(node, mode = 'generate') {
    const promptText = resolveAudioPrompt(node, nodes, connections);
    if (!promptText) {
      updateNode(node.id, { content: '合成文本不能为空，请填写文本或连接文本节点', status: 'error' });
      return;
    }

    const token = getOrRequestToken({ onSaved: refreshUserQuota });
    if (!token) {
      updateNode(node.id, { content: '缺少 token', status: 'error' });
      return;
    }

    if (mode === 'translate') {
      setTranslatingNodeId(node.id);
      try {
        const translated = await runChatCompletion({
          token,
          content: `Detect whether the following text is primarily Chinese or English. If it is Chinese, translate it into natural English. If it is English, translate it into natural Chinese. Return only the translation, with no explanations:\n\n${promptText}`,
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
    updateNode(node.id, { status: 'running', content: '正在合成语音…' });

    try {
      const audioUrl = await createSpeech({
        token,
        input: promptText,
        voice: node.audioVoice,
        speed: node.audioSpeed,
      });
      updateNode(node.id, {
        audioUrl,
        content: audioUrl,
        status: 'idle',
      });
      setSelectedNodeIds([node.id]);
      flushPersist();
    } catch (error) {
      const message = error instanceof Error ? error.message : '语音合成失败';
      updateNode(node.id, { content: message, status: 'error' });
      setSelectedNodeIds([node.id]);
    } finally {
      setRunningNodeId(null);
      refreshUserQuota();
    }
  }

  function getAssetPickerMeta(node, pickMode = 'reference') {
    if (pickMode === 'veo-first') {
      return { maxCount: 1, title: '资产库', subtitle: '选择首帧图片' };
    }
    if (pickMode === 'seedance-first') {
      return { maxCount: 1, title: '满血版素材库', subtitle: '选择首帧图片' };
    }
    if (pickMode === 'veo-last') {
      return { maxCount: 1, title: '资产库', subtitle: '选择尾帧图片（可选）' };
    }
    if (pickMode === 'seedance-last') {
      return { maxCount: 1, title: '满血版素材库', subtitle: '选择尾帧图片（可选）' };
    }
    if (pickMode === 'seedance-reference') {
      const currentCount = Array.isArray(node?.referenceImages) ? node.referenceImages.length : 0;
      return {
        maxCount: Math.max(1, SEEDANCE_REF_IMAGE_MAX - currentCount),
        title: '满血版素材库',
        subtitle: `选择参考图（最多 ${SEEDANCE_REF_IMAGE_MAX} 张）`,
      };
    }
    if (pickMode === 'seedance-ref-video') {
      const currentCount = Array.isArray(node?.videoReferenceVideos) ? node.videoReferenceVideos.length : 0;
      return {
        maxCount: Math.max(1, SEEDANCE_REF_VIDEO_MAX - currentCount),
        title: '满血版素材库',
        subtitle: `选择参考视频（最多 ${SEEDANCE_REF_VIDEO_MAX} 个）`,
      };
    }
    if (pickMode === 'seedance-ref-audio') {
      const currentCount = Array.isArray(node?.videoReferenceAudios) ? node.videoReferenceAudios.length : 0;
      return {
        maxCount: Math.max(1, SEEDANCE_REF_AUDIO_MAX - currentCount),
        title: '满血版素材库',
        subtitle: `选择参考音频（最多 ${SEEDANCE_REF_AUDIO_MAX} 个）`,
      };
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
        subtitle: `选择图片（最多 ${maxOutput} 张）`,
      };
    }
    if (pickMode === 'video-output') {
      return { maxCount: 1, title: '资产库', subtitle: '选择视频' };
    }
    if (pickMode === 'audio-output') {
      return { maxCount: 1, title: '资产库', subtitle: '选择音频' };
    }
    if (pickMode === 'reference') {
      const isImageNode = node?.type === 'image';
      const maxRef = isImageNode ? getImageReferenceMax(node?.imageModel) : VIDEO_GENERIC_REFERENCE_MAX;
      const currentCount = Array.isArray(node?.referenceImages) ? node.referenceImages.length : 0;
      const remaining = Math.max(0, maxRef - currentCount);
      return {
        maxCount: Math.max(1, remaining),
        title: '资产库',
        subtitle:
          remaining > 0
            ? `选择参考图（已选 ${currentCount}/${maxRef}，本次最多 ${remaining} 张）`
            : `选择参考图（已达上限 ${maxRef} 张）`,
      };
    }
    return { maxCount: 5, title: '资产库', subtitle: '选择图片作为参考图' };
  }

  function isSamePickerAsset(left, right) {
    if (left === right) return true;
    if (left?.id != null && right?.id != null && String(left.id) === String(right.id)) return true;
    if (left?.assetId && right?.assetId && left.assetId === right.assetId) return true;
    if (left?.url && right?.url && left.url === right.url) return true;
    return false;
  }

  function normalizeSeedancePickedAsset(asset, mediaType) {
    const normalized = {
      id: asset.id || asset.assetId,
      assetId: asset.assetId || asset.id,
      name: asset.name || (mediaType === 'video' ? '参考视频' : mediaType === 'audio' ? '参考音频' : '参考图'),
      url: asset.url || (asset.assetId ? `asset://${asset.assetId}` : ''),
      originalUrl: asset.originalUrl || asset.original_url || '',
      previewUrl: asset.previewUrl || asset.preview || asset.originalUrl || asset.original_url || '',
      duration: asset.duration,
      source: 'seedance',
      type: mediaType,
    };
    const previewUrl = resolveSeedanceMediaPreviewUrl(normalized, mediaType);
    return {
      ...normalized,
      previewUrl,
      originalUrl: previewUrl || normalized.originalUrl,
    };
  }

  function resolvePersistedAssetUrl(asset, mediaType) {
    const candidate = asset.uploadedUrl || asset.url || asset.path || '';
    const url =
      mediaType === 'audio'
        ? normalizeAudioUrl(candidate)
        : mediaType === 'video'
          ? normalizeVideoUrl(candidate)
          : normalizeImageUrl(candidate);
    if (!url || url.startsWith('data:')) return '';
    return url;
  }

  function buildUploadedAssetReference(file, pickMode, uploadedUrl) {
    const isVideoOutput = pickMode === 'video-output';
    const isAudioOutput = pickMode === 'audio-output';
    const mediaType = isVideoOutput ? 'video' : isAudioOutput ? 'audio' : 'image';
    const url = resolvePersistedAssetUrl({ uploadedUrl, url: uploadedUrl }, mediaType);
    if (!url) {
      throw new Error('上传失败，未获得有效链接');
    }
    return {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name:
        file.name ||
        (mediaType === 'video' ? '本地视频' : mediaType === 'audio' ? '本地音频' : '本地图片'),
      url,
      uploadedUrl: url,
      source: 'local',
      type: mediaType,
    };
  }

  function applyPickedAssetsToNode(node, pickMode, pickedAssets, source) {
    const isVideoOutput = pickMode === 'video-output';
    const isAudioOutput = pickMode === 'audio-output';
    const isSeedancePick = String(pickMode).startsWith('seedance-');
    const normalized = isSeedancePick
      ? pickedAssets.map((asset) => {
          const mediaType = pickMode.includes('video')
            ? 'video'
            : pickMode.includes('audio')
              ? 'audio'
              : 'image';
          return normalizeSeedancePickedAsset(asset, mediaType);
        })
      : pickedAssets
          .map((asset) => {
            const mediaType = isVideoOutput ? 'video' : isAudioOutput ? 'audio' : 'image';
            const url = resolvePersistedAssetUrl(asset, mediaType);
            if (!url) return null;
            return {
              id: asset.id,
              name:
                asset.name ||
                (isVideoOutput ? '视频资产' : isAudioOutput ? '音频资产' : '图片资产'),
              url,
              source,
              type: mediaType,
            };
          })
          .filter(Boolean);

    if (pickMode === 'veo-first' || pickMode === 'seedance-first') {
      const patch = { videoFirstFrame: normalized[0] || null, status: 'idle' };
      if (pickMode === 'seedance-first') {
        patch.referenceImages = [];
        patch.videoReferenceVideos = [];
        patch.videoReferenceAudios = [];
      }
      return { ...node, ...patch };
    }
    if (pickMode === 'veo-last' || pickMode === 'seedance-last') {
      if (!node.videoFirstFrame) return node;
      return { ...node, videoLastFrame: normalized[0] || null, status: 'idle' };
    }
    if (pickMode === 'seedance-reference') {
      const current = Array.isArray(node.referenceImages) ? node.referenceImages : [];
      return {
        ...node,
        referenceImages: [...current, ...normalized].slice(0, SEEDANCE_REF_IMAGE_MAX),
        videoFirstFrame: null,
        videoLastFrame: null,
        videoReferenceVideos: [],
        videoReferenceAudios: [],
        status: 'idle',
      };
    }
    if (pickMode === 'seedance-ref-video') {
      const current = Array.isArray(node.videoReferenceVideos) ? node.videoReferenceVideos : [];
      return {
        ...node,
        videoReferenceVideos: [...current, ...normalized].slice(0, SEEDANCE_REF_VIDEO_MAX),
        status: 'idle',
      };
    }
    if (pickMode === 'seedance-ref-audio') {
      const current = Array.isArray(node.videoReferenceAudios) ? node.videoReferenceAudios : [];
      return {
        ...node,
        videoReferenceAudios: [...current, ...normalized].slice(0, SEEDANCE_REF_AUDIO_MAX),
        status: 'idle',
      };
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
    if (pickMode === 'video-output') {
      const urls = normalized.map((asset) => asset.url).filter(Boolean);
      if (urls.length === 0) return node;
      return {
        ...node,
        videos: urls,
        content: urls[0],
        status: 'idle',
        videoTaskId: undefined,
        pendingTasks: undefined,
        generationJob: undefined,
        generationBatch: undefined,
        taskStatus: undefined,
        taskProgress: undefined,
        taskProvider: undefined,
        taskQueryModel: undefined,
        taskVeoSource: undefined,
        ...buildVideoNodeLayoutPatch(node),
      };
    }
    if (pickMode === 'audio-output') {
      const url = normalized[0]?.url || '';
      if (!url) return node;
      return {
        ...node,
        audioUrl: url,
        content: url,
        status: 'idle',
      };
    }

    const current = Array.isArray(node.referenceImages) ? node.referenceImages : [];
    const maxRef =
      node?.type === 'image' ? getImageReferenceMax(node?.imageModel) : VIDEO_GENERIC_REFERENCE_MAX;
    return {
      ...node,
      referenceImages: [...current, ...normalized].slice(0, maxRef),
      status: 'idle',
    };
  }

  async function uploadImageReferences(nodeId, files, pickMode = 'reference') {
    const token = getOrRequestToken({ onSaved: refreshUserQuota });
    if (!token) {
      updateNode(nodeId, { content: '缺少 token', status: 'error' });
      return false;
    }

    const node = nodes.find((item) => item.id === nodeId);
    if ((pickMode === 'veo-last' || pickMode === 'seedance-last') && !node?.videoFirstFrame) {
      return false;
    }
    const { maxCount } = getAssetPickerMeta(node, pickMode);

    const isVideoOutput = pickMode === 'video-output';
    const isAudioOutput = pickMode === 'audio-output';

    setUploadingNodeId(nodeId);
    try {
      const references = [];
      const uploadFiles = isAudioOutput ? filterAudioFiles(files) : files.slice(0, maxCount);
      if (isAudioOutput && uploadFiles.length === 0) {
        throw new Error('请选择 MP3 音频文件');
      }
      for (const file of uploadFiles.slice(0, maxCount)) {
        if (isAudioOutput && !isAudioFile(file)) {
          continue;
        }
        const uploadedUrl = await uploadAsset({ token, file });
        references.push(buildUploadedAssetReference(file, pickMode, uploadedUrl));
      }

      updateActiveCanvas((doc) => ({
        ...doc,
        nodes: doc.nodes.map((item) => {
          if (item.id !== nodeId) return item;
          return applyPickedAssetsToNode(item, pickMode, references, 'local');
        }),
      }));
      return references.length > 0;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isVideoOutput
            ? '上传视频失败'
            : isAudioOutput
              ? '上传音频失败'
              : '上传图片失败';
      updateNode(nodeId, { content: message, status: 'error' });
      return false;
    } finally {
      setUploadingNodeId(null);
    }
  }

  async function uploadAssetsToLibrary(nodeId, files, pickMode) {
    const token = getOrRequestToken({ onSaved: refreshUserQuota });
    if (!token) return false;

    const node = nodes.find((item) => item.id === nodeId);
    const { maxCount } = getAssetPickerMeta(node, pickMode);
    const isAudioOutput = pickMode === 'audio-output';
    const uploadFiles = isAudioOutput ? filterAudioFiles(files) : files.slice(0, maxCount);

    if (isAudioOutput && uploadFiles.length === 0) {
      return false;
    }

    try {
      for (const file of uploadFiles.slice(0, maxCount)) {
        if (isAudioOutput && !isAudioFile(file)) continue;
        await uploadAsset({ token, file });
      }
      return uploadFiles.length > 0;
    } catch (error) {
      console.error('Upload to asset library failed:', error);
      return false;
    }
  }

  async function uploadFromAssetPicker(nodeId, files, pickMode) {
    const isReferenceLibraryUpload = pickMode === 'reference' || pickMode === 'veo-reference';
    const succeeded = isReferenceLibraryUpload
      ? await uploadAssetsToLibrary(nodeId, files, pickMode)
      : await uploadImageReferences(nodeId, files, pickMode);
    if (!succeeded) return;

    setAssetPicker((current) => {
      if (current.nodeId !== nodeId) return current;
      return current.source === 'local'
        ? current
        : { ...current, source: 'local', selectedAssets: [] };
    });
    await loadAssetPickerAssets('local', pickMode);
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
    if ((pickMode === 'veo-last' || pickMode === 'seedance-last') && !node?.videoFirstFrame) {
      return;
    }
    const meta = getAssetPickerMeta(node, pickMode);
    const isSeedanceLibrary = String(pickMode).startsWith('seedance-');
    setAssetPicker({
      nodeId,
      pickMode,
      maxCount: meta.maxCount,
      title: meta.title,
      subtitle: meta.subtitle,
      source: isSeedanceLibrary ? 'seedance' : 'local',
      assets: [],
      selectedAssets: [],
      search: '',
      loading: true,
      seedanceStatus: 'Active',
      seedanceAuditing: false,
      seedanceNotice: '',
    });
  }

  function getSeedancePickerMediaType(pickMode = assetPicker.pickMode) {
    if (pickMode === 'seedance-ref-video') return 'video';
    if (pickMode === 'seedance-ref-audio') return 'audio';
    return 'image';
  }

  async function loadSeedanceAssetPickerAssets(status = 'Active') {
    const token = getOrRequestToken({ onSaved: refreshUserQuota });
    if (!token) {
      setAssetPicker((current) => ({ ...current, loading: false }));
      return;
    }

    const mediaType = getSeedancePickerMediaType();
    setAssetPicker((current) => ({ ...current, loading: true }));
    try {
      const result = await getSd2ManxueAssetList({
        token,
        page: 1,
        pageSize: 48,
        mediaType,
        status,
      });
      setAssetPicker((current) => ({
        ...current,
        assets: result.list || [],
        loading: false,
      }));
    } catch {
      setAssetPicker((current) => ({ ...current, assets: [], loading: false }));
    }
  }

  async function uploadSeedanceForAudit(files) {
    const token = getOrRequestToken({ onSaved: refreshUserQuota });
    if (!token) {
      setAssetPicker((current) => ({
        ...current,
        seedanceNotice: '缺少 token，请先登录',
      }));
      return;
    }

    const mediaType = getSeedancePickerMediaType();
    setAssetPicker((current) => ({
      ...current,
      seedanceAuditing: true,
      seedanceNotice: '',
    }));

    try {
      const result = await uploadAndAuditSeedanceAssets({ token, mediaType, files });
      if (result.passed) {
        setAssetPicker((current) => ({
          ...current,
          seedanceStatus: 'Active',
          seedanceNotice: '素材已审核通过，可直接选择',
        }));
        await loadSeedanceAssetPickerAssets('Active');
      } else {
        setAssetPicker((current) => ({
          ...current,
          seedanceStatus: 'Pending',
          seedanceNotice: '已提交审核，请在「审核中」查看进度',
        }));
        await loadSeedanceAssetPickerAssets('Pending');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传或审核失败';
      setAssetPicker((current) => ({
        ...current,
        seedanceNotice: message,
      }));
    } finally {
      setAssetPicker((current) => ({ ...current, seedanceAuditing: false }));
    }
  }

  async function loadAssetPickerAssets(source, pickMode = assetPicker.pickMode) {
    const token = getOrRequestToken({ onSaved: refreshUserQuota });
    if (!token) {
      setAssetPicker((current) => ({ ...current, loading: false }));
      return;
    }

    const isSeedanceLibrary = String(pickMode).startsWith('seedance-');
    const mediaType = pickMode === 'video-output' || pickMode === 'seedance-ref-video'
      ? 'video'
      : pickMode === 'seedance-ref-audio' || pickMode === 'audio-output'
        ? 'audio'
        : 'image';
    const assetSource = pickMode === 'video-output' || pickMode === 'audio-output' ? 'local' : source;

    setAssetPicker((current) => ({ ...current, loading: true, assets: [] }));
    try {
      const result = isSeedanceLibrary
        ? await getSd2ManxueAssetList({
            token,
            page: 1,
            pageSize: 36,
            mediaType,
            status: 'Active',
          })
        : await getAssetList({
            token,
            source: assetSource,
            page: 1,
            pageSize: 36,
            mediaType: mediaType === 'audio' ? 'image' : mediaType,
          });
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
      if (String(current.pickMode).startsWith('seedance-') && asset.status !== 'Active') {
        return current;
      }
      if (current.pickMode === 'audio-output' && !isAudioAssetRecord(asset)) {
        return current;
      }
      const exists = current.selectedAssets.some((item) => isSamePickerAsset(item, asset));
      if (exists) {
        return {
          ...current,
          selectedAssets: current.selectedAssets.filter((item) => !isSamePickerAsset(item, asset)),
        };
      }
      if (current.selectedAssets.length >= current.maxCount) {
        if (current.maxCount === 1) {
          return { ...current, selectedAssets: [asset] };
        }
        return current;
      }
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

  function removeSeedanceMedia(nodeId, mediaType, index) {
    updateActiveCanvas((doc) => ({
      ...doc,
      nodes: doc.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        if (mediaType === 'video') {
          const items = Array.isArray(node.videoReferenceVideos) ? node.videoReferenceVideos : [];
          return { ...node, videoReferenceVideos: items.filter((_, itemIndex) => itemIndex !== index) };
        }
        if (mediaType === 'audio') {
          const items = Array.isArray(node.videoReferenceAudios) ? node.videoReferenceAudios : [];
          return { ...node, videoReferenceAudios: items.filter((_, itemIndex) => itemIndex !== index) };
        }
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
        additive: marquee.additive,
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
        void flushPersist();
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
        onOpenWorkflowTemplates={() => setWorkflowTemplateOpen(true)}
      />

      {importError ? <div className="toast-error">{importError}</div> : null}
      {copyNotice ? <div className="toast-info toast-copy">{copyNotice}</div> : null}
      {storageNotice ? (
        <div className="toast-info">
          <span>{storageNotice}</span>
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

      {enlargedSettingsNode && enlargedSettingsNodeType ? (
        <NodeSettingsModal
          node={enlargedSettingsNode}
          nodeType={enlargedSettingsNodeType}
          textInputLinks={getTextInputLinks(enlargedSettingsNode.id, nodes, connections)}
          imageInputLinks={getImageInputLinks(enlargedSettingsNode.id, nodes, connections)}
          isRunning={isNodeActivelyRunning(enlargedSettingsNode, runningNodeId)}
          isTranslating={translatingNodeId === enlargedSettingsNode.id}
          onUpdateNode={updateNode}
          onClose={closeEnlargedNodeSettings}
          onRunImageGeneration={runImageGeneration}
          onRunVideoGeneration={runVideoGeneration}
          onOpenAssetLibrary={openAssetLibrary}
          onRemoveImageReference={removeImageReference}
          onRemoveTextReference={removeTextReference}
          onRemoveVeoFrame={removeVeoFrame}
          onRemoveSeedanceMedia={removeSeedanceMedia}
        />
      ) : null}

      {imagePreview ? (
        <ImagePreviewModal
          images={imagePreview.images}
          activeIndex={imagePreview.index}
          title={imagePreview.title}
          onSelectIndex={(index) => setImagePreview((current) => ({ ...current, index }))}
          onDownload={(images, title) => handleDownloadImage(images, title)}
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

      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        title="删除项目"
        message={
          deleteConfirm
            ? `确定删除「${deleteConfirm.name}」吗？此操作不可恢复。`
            : ''
        }
        confirmLabel="删除"
        cancelLabel="取消"
        variant="danger"
        loading={deleteConfirmLoading}
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => {
          if (!deleteConfirmLoading) setDeleteConfirm(null);
        }}
      />

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
        String(assetPicker.pickMode).startsWith('seedance-') ? (
          <SeedanceAssetPickerModal
            assets={assetPicker.assets}
            loading={assetPicker.loading}
            auditing={assetPicker.seedanceAuditing}
            statusFilter={assetPicker.seedanceStatus}
            search={assetPicker.search}
            selectedAssets={assetPicker.selectedAssets}
            maxCount={assetPicker.maxCount}
            title={assetPicker.title}
            subtitle={assetPicker.subtitle}
            mediaType={getSeedancePickerMediaType(assetPicker.pickMode)}
            notice={assetPicker.seedanceNotice}
            onStatusFilterChange={(seedanceStatus) =>
              setAssetPicker((current) => ({
                ...current,
                seedanceStatus,
                selectedAssets: [],
                seedanceNotice: '',
              }))
            }
            onSearchChange={(search) => setAssetPicker((current) => ({ ...current, search }))}
            onToggleAsset={toggleAssetSelection}
            onUploadForAudit={uploadSeedanceForAudit}
            onConfirm={confirmAssetSelection}
            onClose={() => setAssetPicker((current) => ({ ...current, nodeId: null }))}
          />
        ) : (
          <AssetPickerModal
            assets={assetPicker.assets}
            loading={assetPicker.loading}
            source={assetPicker.source}
            search={assetPicker.search}
            selectedAssets={assetPicker.selectedAssets}
            maxCount={assetPicker.maxCount}
            title={assetPicker.title}
            subtitle={assetPicker.subtitle}
            mediaType={
              assetPicker.pickMode === 'video-output'
                ? 'video'
                : assetPicker.pickMode === 'audio-output'
                  ? 'audio'
                  : 'image'
            }
            onSourceChange={(source) =>
              setAssetPicker((current) => ({ ...current, source, selectedAssets: [] }))
            }
            onSearchChange={(search) => setAssetPicker((current) => ({ ...current, search }))}
            onToggleAsset={toggleAssetSelection}
            onUploadImages={(files) =>
              uploadFromAssetPicker(assetPicker.nodeId, files, assetPicker.pickMode)
            }
            onConfirm={confirmAssetSelection}
            onClose={() => setAssetPicker((current) => ({ ...current, nodeId: null }))}
          />
        )
      ) : null}

      <main className="workspace">
        <Topbar
          activeCanvas={canvasReady ? activeCanvas : null}
          projectLoading={!canvasReady}
          siteTitle={siteSettings.title}
          siteLogoUrl={siteSettings.logoUrl}
          nodesCount={nodes.length}
          connectionsCount={connections.length}
          onRenameCanvas={renameCanvas}
          onGoHome={navigateToCanvasHome}
          onViewAllProjects={navigateToCanvasHome}
          onCreateProject={createCanvas}
          onDeleteProject={handleDeleteCurrentProject}
          onOpenKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
          onOpenCustomerService={() => setShowCustomerService(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          cloudSyncStatus={cloudSyncStatus}
          cloudLastSyncedAt={cloudLastSyncedAt}
          quotaVisible={Boolean(getStoredChatToken())}
          quotaLoading={Boolean(getStoredChatToken()) && userQuota.loading}
          quotaRemaining={userQuota.remaining}
          quotaPercentage={userQuota.percentage}
          onRecharge={openRechargeModal}
        />

        <section
          className={`stage ${linkFromNodeId ? 'link-mode' : ''} ${isPanning ? 'is-panning' : ''} ${isResizing ? 'is-resizing' : ''} ${selectionMarquee ? 'is-marquee-selecting' : ''} ${!canvasReady ? 'is-hydrating' : ''}`}
          data-background={canvasBackground}
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
          {!canvasReady ? (
            <div className="canvas-hydrate-overlay" aria-live="polite" aria-busy="true">
              <Loader2 size={28} className="spin-icon" />
              <span>正在同步画布…</span>
            </div>
          ) : null}
          <div className={`stage-content ${!canvasReady ? 'is-hidden' : ''}`}>
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
                isSelected={displaySelectedNodeIds.includes(node.id)}
                showToolbar={
                  !selectionMarquee &&
                  selectedNodeIds.length === 1 &&
                  selectedNodeIds[0] === node.id &&
                  enlargedNodeSettings?.nodeId !== node.id
                }
                isRunning={isNodeActivelyRunning(node, runningNodeId)}
                isTranslating={translatingNodeId === node.id}
                textInputLinks={
                  node.type === 'image' || node.type === 'video' || node.type === 'audio'
                    ? getTextInputLinks(node.id, nodes, connections)
                    : []
                }
                imageInputLinks={
                  node.type === 'image' || node.type === 'video' || node.type === 'note'
                    ? getImageInputLinks(node.id, nodes, connections)
                    : []
                }
                videoInputLinks={
                  node.type === 'note'
                    ? getVideoInputLinks(node.id, nodes, connections)
                    : []
                }
                isInputsHighlighted={inputHighlightNodeId === node.id}
                linkFromNodeId={linkFromNodeId}
                onSelectNode={selectNode}
                onClearConnectionSelection={() => setSelectedConnectionId(null)}
                onBeginDrag={beginDrag}
                onBeginResize={beginResize}
                onOpenTextEdit={openEnlargedTextEdit}
                onOpenEnlargedSettings={() => openEnlargedNodeSettings(node.id)}
                onCopyNode={duplicateNodeById}
                onUpdateNode={updateNode}
                onRemoveNode={removeNode}
                onRunTextGeneration={runTextGeneration}
                onRunImageGeneration={runImageGeneration}
                onRunVideoGeneration={runVideoGeneration}
                onRunAudioGeneration={runAudioGeneration}
                onOpenAssetLibrary={openAssetLibrary}
                onUploadImageOutput={(nodeId, files) => uploadImageReferences(nodeId, files, 'output')}
                onUploadVideoOutput={(nodeId, files) => uploadImageReferences(nodeId, files, 'video-output')}
                onUploadAudioOutput={(nodeId, files) => uploadImageReferences(nodeId, files, 'audio-output')}
                onRemoveImageReference={removeImageReference}
                onRemoveTextReference={removeTextReference}
                onHighlightInputs={highlightNodeInputs}
                onPreviewImage={(images, index) =>
                  openImagePreview(images, index, node.title || '图片预览')
                }
                onPreviewVideo={(videoUrl, title) => openVideoPreview(videoUrl, title)}
                onDownloadVideo={handleDownloadVideo}
                onDownloadImage={handleDownloadImage}
                onSyncImageOutputLayout={syncImageNodeOutputLayout}
                onSplitImageNode={handleSplitImageNode}
                onExplodeImageOutputs={handleExplodeImageOutputs}
                onSyncVideoOutputLayout={syncVideoNodeOutputLayout}
                onSyncAudioOutputLayout={syncAudioNodeOutputLayout}
                onRemoveVeoFrame={removeVeoFrame}
                onRemoveSeedanceMedia={removeSeedanceMedia}
                onPortPointerDown={handlePortPointerDown}
                onFinishLink={finishLink}
              />
            ))}
          </div>

          {showFocusContentPrompt ? (
            <FocusContentPrompt nodeCount={nodes.length} onFocus={focusViewportOnContent} />
          ) : null}

          <div className="stage-bottom-controls">
            <CanvasZoomControls
              canvasScalePercent={canvasScalePercent}
              onZoom={zoomCanvas}
              onScaleChange={setCanvasScaleClamped}
              onResetScale={resetCanvasScale}
            />
            <CanvasBackgroundPicker
              value={canvasBackground}
              onChange={updateCanvasBackground}
              disabled={!canvasReady}
            />
          </div>

          <CanvasMinimap
            nodes={nodes}
            selectedNodeIds={selectedNodeIds}
            stageWidth={stageSize.width}
            stageHeight={stageSize.height}
            canvasScale={canvasScale}
            viewportOffset={viewportOffset}
            onViewportChange={setViewportOffset}
            disabled={!canvasReady}
          />
        </section>
      </main>

      <WorkflowTemplateModal
        isOpen={workflowTemplateOpen}
        onClose={() => setWorkflowTemplateOpen(false)}
        onSelect={insertWorkflowTemplate}
        mode="insert"
      />
    </div>
  );
}

export default App;
