import { waitForImageTask } from './imageApi';
import { buildImageNodeLayoutPatch, isDefaultDemoImageOutput } from './imageNodeLayout';
import { buildVideoNodeLayoutPatch } from './videoNodeLayout';
import { waitForVideoTask } from './videoApi';

const RECOVER_STAGGER_MS = 500;

function isImageOutput(content) {
  const value = String(content || '').trim();
  if (!value) return false;
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:image') ||
    value.startsWith('blob:') ||
    value.startsWith('/')
  ) {
    return true;
  }
  return /^(image|video|audio)\//.test(value);
}

function isVideoOutput(content) {
  const value = String(content || '').trim();
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('blob:') ||
    value.startsWith('/')
  );
}

export function hasImageOutput(node) {
  if (!node) return false;
  const images = Array.isArray(node.images) ? node.images : [];
  if (images.some((url) => isImageOutput(url))) return true;
  return isImageOutput(node.content);
}

export function hasVideoOutput(node) {
  if (!node) return false;
  const videos = Array.isArray(node.videos) ? node.videos : [];
  if (videos.some((url) => isVideoOutput(url))) return true;
  return isVideoOutput(node.content);
}

export function getImageTaskId(node) {
  if (!node) return '';
  return (
    node.imageTaskId ||
    node.generationJob?.pendingTasks?.[0]?.taskId ||
    node.pendingTasks?.[0]?.taskId ||
    ''
  );
}

export function getVideoTaskId(node) {
  if (!node) return '';
  return (
    node.videoTaskId ||
    node.generationJob?.pendingTasks?.[0]?.taskId ||
    node.pendingTasks?.[0]?.taskId ||
    ''
  );
}

export function getGenerationBatch(node, defaultTotal = 1) {
  if (node?.generationBatch) {
    return {
      total: Number(node.generationBatch.total) || defaultTotal,
      completed: Number(node.generationBatch.completed) || 0,
    };
  }
  if (node?.generationJob) {
    return {
      total: Number(node.generationJob.total) || defaultTotal,
      completed: Number(node.generationJob.completed) || 0,
    };
  }
  return { total: defaultTotal, completed: 0 };
}

export function hasNodePendingWork(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.status === 'running') return true;
  if (getImageTaskId(node) || getVideoTaskId(node)) return true;
  const batch = getGenerationBatch(node, 1);
  return batch.completed < batch.total;
}

export function hasPendingTasks(documents) {
  if (!Array.isArray(documents)) return false;
  return documents.some((doc) => Array.isArray(doc.nodes) && doc.nodes.some(hasNodePendingWork));
}

function getDisplayImageUrls(node) {
  if (!node) return [];
  const images = Array.isArray(node.images) ? node.images.filter(Boolean) : [];
  if (images.length > 0) return images;
  const content = String(node.content || '').trim();
  return content ? [content] : [];
}

function hasGeneratedImageOutput(node) {
  if (!hasImageOutput(node)) return false;
  return !isDefaultDemoImageOutput(getDisplayImageUrls(node));
}

/** 合并同一节点时优先保留已有真实生成结果，避免云端 stale running 覆盖本地已完成输出 */
export function pickPreferredCanvasNode(serverNode, clientNode) {
  if (!clientNode) return serverNode;
  if (!serverNode) return clientNode;

  const serverPending = hasNodePendingWork(serverNode);
  const clientPending = hasNodePendingWork(clientNode);
  const serverGenerated = hasGeneratedImageOutput(serverNode);
  const clientGenerated = hasGeneratedImageOutput(clientNode);
  const serverVideo = hasVideoOutput(serverNode);
  const clientVideo = hasVideoOutput(clientNode);

  if (clientGenerated && (!serverGenerated || serverPending)) return clientNode;
  if (serverGenerated && !clientGenerated && !clientPending) return serverNode;

  if (clientVideo && (!serverVideo || serverPending)) return clientNode;
  if (serverVideo && !clientVideo && !clientPending) return serverNode;

  if (clientPending && !serverPending) return clientNode;
  if (serverPending && !clientPending) {
    if (clientGenerated || clientVideo) return clientNode;
    return serverNode;
  }

  if (clientGenerated && !serverGenerated) return clientNode;
  if (serverGenerated && !clientGenerated) return serverNode;

  return clientNode;
}

export function mergeDocumentsPreservePending(localDocs, cloudDocs, options = {}) {
  const preserveCloudOnlyDocuments = options.preserveCloudOnlyDocuments !== false;

  if (!Array.isArray(cloudDocs) || cloudDocs.length === 0) {
    return localDocs;
  }
  if (!Array.isArray(localDocs) || localDocs.length === 0) {
    return cloudDocs;
  }

  const cloudById = new Map(cloudDocs.map((doc) => [doc.id, doc]));

  const mergedLocal = localDocs.map((localDoc) => {
    const cloudDoc = cloudById.get(localDoc.id);
    if (!cloudDoc) return localDoc;

    const cloudNodeById = new Map(
      (Array.isArray(cloudDoc.nodes) ? cloudDoc.nodes : []).map((node) => [node.id, node])
    );
    const localNodeIds = new Set();

    const nodes = (Array.isArray(localDoc.nodes) ? localDoc.nodes : []).map((serverNode) => {
      localNodeIds.add(serverNode.id);
      const clientNode = cloudNodeById.get(serverNode.id);
      return pickPreferredCanvasNode(serverNode, clientNode);
    });

    for (const cloudNode of cloudNodeById.values()) {
      if (!localNodeIds.has(cloudNode.id)) {
        nodes.push(cloudNode);
      }
    }

    return {
      ...localDoc,
      name: cloudDoc.name || localDoc.name,
      connections: Array.isArray(cloudDoc.connections) ? cloudDoc.connections : localDoc.connections,
      nodes,
      updatedAt: Math.max(Number(localDoc.updatedAt) || 0, Number(cloudDoc.updatedAt) || 0),
    };
  });

  if (preserveCloudOnlyDocuments) {
    for (const cloudDoc of cloudDocs) {
      if (!mergedLocal.some((doc) => doc.id === cloudDoc.id)) {
        mergedLocal.push(cloudDoc);
      }
    }
  }

  return mergedLocal;
}

/** 与 Penguin-Magic recoverVideoTasks 一致：找出可恢复的进行中节点 */
export function findRecoverableNodes(documents) {
  const targets = [];
  if (!Array.isArray(documents)) return targets;

  for (const doc of documents) {
    if (!Array.isArray(doc.nodes)) continue;
    for (const node of doc.nodes) {
      if (node.type === 'image' && node.status === 'running') {
        const taskId = getImageTaskId(node);
        if (taskId && !hasImageOutput(node)) {
          targets.push({ canvasId: doc.id, node, kind: 'image' });
          continue;
        }
        const batch = getGenerationBatch(node, 1);
        if (batch.completed < batch.total) {
          targets.push({ canvasId: doc.id, node, kind: 'image' });
        }
        continue;
      }

      if (node.type === 'video' && node.status === 'running') {
        const taskId = getVideoTaskId(node);
        if (taskId && !hasVideoOutput(node)) {
          targets.push({ canvasId: doc.id, node, kind: 'video' });
          continue;
        }
        const batch = getGenerationBatch(node, 1);
        if (batch.completed < batch.total) {
          targets.push({ canvasId: doc.id, node, kind: 'video' });
        }
      }
    }
  }
  return targets;
}

export function recoverTaskKey(canvasId, node) {
  const taskId = getImageTaskId(node) || getVideoTaskId(node);
  const batch = getGenerationBatch(node, 1);
  return `${canvasId}:${node.id}:${taskId || 'batch'}:${batch.completed}`;
}

/**
 * 加载画布后错峰恢复任务（参考 Penguin-Magic recoverVideoTasks）
 */
export function recoverPendingTasks(documents, onRecoverNode, { staggerMs = RECOVER_STAGGER_MS } = {}) {
  const targets = findRecoverableNodes(documents);
  if (targets.length === 0) return 0;

  targets.forEach((target, index) => {
    window.setTimeout(() => {
      onRecoverNode(target);
    }, index * staggerMs);
  });

  return targets.length;
}

function clearImageTaskFields() {
  return {
    imageTaskId: undefined,
    pendingTasks: undefined,
    generationJob: undefined,
    taskStatus: undefined,
    taskProgress: undefined,
  };
}

function clearVideoTaskFields() {
  return {
    videoTaskId: undefined,
    pendingTasks: undefined,
    generationJob: undefined,
    taskProvider: undefined,
    taskQueryModel: undefined,
    taskVeoSource: undefined,
    taskStatus: undefined,
    taskProgress: undefined,
  };
}

export async function executeImageGeneration(
  node,
  { token, updateNode, createImageGenerationTask, normalizeImageModelSettings, onPersist }
) {
  const promptText = String(node.prompt || '').trim();
  const settings = normalizeImageModelSettings({
    model: node.imageModel,
    resolution: node.imageResolution,
    ratio: node.imageRatio,
    count: node.imageCount,
    quality: node.imageQuality,
  });
  let batch = getGenerationBatch(node, settings.count);
  const isResume = batch.completed > 0 || Boolean(getImageTaskId(node));
  let images = isResume && Array.isArray(node.images) ? [...node.images] : [];

  updateNode(node.id, {
    status: 'running',
    generationBatch: batch,
  });

  while (batch.completed < batch.total) {
    let taskId = getImageTaskId(node) || '';

    if (!taskId) {
      taskId = await createImageGenerationTask({
        token,
        prompt: promptText,
        model: settings.model,
        ratio: settings.ratio,
        resolution: settings.resolution,
        quality: settings.quality,
        referenceImages: node.referenceImages || [],
      });

      updateNode(node.id, {
        status: 'running',
        imageTaskId: taskId,
        generationBatch: batch,
        pendingTasks: [{ taskId, taskType: 'image' }],
      });
      node = { ...node, imageTaskId: taskId, status: 'running', generationBatch: batch };
      if (onPersist) onPersist();
    }

    const taskImages = await waitForImageTask({
      token,
      taskId,
      onProgress: ({ status, progress }) => {
        updateNode(node.id, {
          taskStatus: status,
          taskProgress: progress,
        });
      },
    });
    images = [...images, ...taskImages];
    batch = { ...batch, completed: batch.completed + 1 };

    updateNode(node.id, {
      content: images[0] || node.content,
      images,
      status: batch.completed < batch.total ? 'running' : 'idle',
      generationBatch: batch.completed < batch.total ? batch : undefined,
      ...buildImageNodeLayoutPatch({
        imageRatio: settings.ratio,
        imageCount: images.length,
      }),
      ...clearImageTaskFields(),
    });
    node = {
      ...node,
      content: images[0],
      images,
      status: batch.completed < batch.total ? 'running' : 'idle',
      generationBatch: batch,
      imageTaskId: undefined,
    };
    if (onPersist) onPersist();
  }

  updateNode(node.id, {
    content: images[0] || node.content,
    images,
    status: 'idle',
    generationBatch: undefined,
    ...buildImageNodeLayoutPatch({
      imageRatio: settings.ratio,
      imageCount: images.length,
    }),
    ...clearImageTaskFields(),
  });
  if (onPersist) onPersist();
}

export async function executeVideoGeneration(
  node,
  { token, updateNode, createVideoGenerationTask, normalizeVideoModelSettings, inferVideoFamily, onPersist }
) {
  const promptText = String(node.prompt || '').trim();
  const family = inferVideoFamily(node);
  const settings = normalizeVideoModelSettings({
    family,
    model: node.videoModel,
    size: node.videoSize,
    resolution: node.videoResolution,
    orientation: node.videoOrientation,
    ratio: node.videoRatio,
    quality: node.videoQuality,
    duration: node.videoDuration,
    generationType: node.videoGenerationType,
    count: node.videoCount,
    route: node.videoRoute,
  });
  let batch = getGenerationBatch(node, settings.count);
  const isResume = batch.completed > 0 || Boolean(getVideoTaskId(node));
  let videos = isResume && Array.isArray(node.videos) ? [...node.videos] : [];

  updateNode(node.id, {
    status: 'running',
    generationBatch: batch,
    videoFamily: settings.family,
  });

  while (batch.completed < batch.total) {
    let taskId = getVideoTaskId(node) || '';

    if (!taskId) {
      const created = await createVideoGenerationTask({
        token,
        prompt: promptText,
        settings,
        referenceImages: node.referenceImages || [],
        veoFrames:
          family === 'veo'
            ? {
                firstFrame: node.videoFirstFrame,
                lastFrame: node.videoLastFrame,
              }
            : {},
        seedanceInputs:
          family === 'seedance'
            ? {
                firstFrame: node.videoFirstFrame,
                lastFrame: node.videoLastFrame,
                referenceVideos: node.videoReferenceVideos || [],
                referenceAudios: node.videoReferenceAudios || [],
                videoRefDuration: (node.videoReferenceVideos || []).reduce(
                  (sum, item) => sum + (Number(item?.duration) || 0),
                  0
                ),
              }
            : {},
      });
      taskId = created.taskId;
      const provider = created.provider;
      const queryModel = created.queryModel;
      const veoSource = created.veoSource;

      updateNode(node.id, {
        status: 'running',
        videoTaskId: taskId,
        taskProvider: provider,
        taskQueryModel: queryModel,
        taskVeoSource: veoSource,
        videoTaskSource: veoSource || node.videoTaskSource,
        generationBatch: batch,
        pendingTasks: [{ taskId, taskType: 'video', provider, queryModel, veoSource }],
      });
      node = {
        ...node,
        videoTaskId: taskId,
        taskProvider: provider,
        taskQueryModel: queryModel,
        taskVeoSource: veoSource,
        status: 'running',
        generationBatch: batch,
      };
      if (onPersist) onPersist();
    }

    const videoUrl = await waitForVideoTask({
      token,
      taskId,
      onProgress: ({ status, progress }) => {
        updateNode(node.id, {
          taskStatus: status,
          taskProgress: progress,
        });
      },
    });
    videos = [...videos, videoUrl];
    batch = { ...batch, completed: batch.completed + 1 };

    updateNode(node.id, {
      content: videos[0] || node.content,
      videos,
      videoFamily: settings.family,
      videoTaskSource: node.taskVeoSource || node.videoTaskSource,
      status: batch.completed < batch.total ? 'running' : 'idle',
      generationBatch: batch.completed < batch.total ? batch : undefined,
      ...buildVideoNodeLayoutPatch({
        ...node,
        videoFamily: settings.family,
        videoOrientation: settings.orientation,
        videoRatio: settings.ratio,
        videoSize: settings.size,
      }),
      ...clearVideoTaskFields(),
    });
    node = {
      ...node,
      content: videos[0],
      videos,
      status: batch.completed < batch.total ? 'running' : 'idle',
      generationBatch: batch,
      videoTaskId: undefined,
    };
    if (onPersist) onPersist();
  }

  updateNode(node.id, {
    content: videos[0] || node.content,
    videos,
    status: 'idle',
    generationBatch: undefined,
    ...buildVideoNodeLayoutPatch({
      ...node,
      videoFamily: settings.family,
      videoOrientation: settings.orientation,
      videoRatio: settings.ratio,
      videoSize: settings.size,
    }),
    ...clearVideoTaskFields(),
  });
  if (onPersist) onPersist();
}

/** UI：与 Penguin-Magic 一致，以节点 status 为准 */
export function isNodeActivelyRunning(node, runningNodeId) {
  if (runningNodeId && runningNodeId === node.id) return true;
  return node?.status === 'running';
}
