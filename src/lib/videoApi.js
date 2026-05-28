import { DEFAULT_VIDEO_FAMILY, DEFAULT_VIDEO_ROUTE } from './constants';
import { requestJimiaigo, requestJimiaigoForm } from './jimiaigoApi';
import { normalizeImageUrl, uploadAsset } from './imageApi';

const TASK_SUCCESS_STATUS = new Set(['success', 'completed', 'succeed', '1']);
const TASK_FAILED_STATUS = new Set(['failed', 'error', 'failure', 'fail', 'cancelled', 'canceled', '2']);
const TASK_PENDING_STATUS = new Set([
  'pending',
  'queued',
  'processing',
  'in_progress',
  'running',
  '0',
]);

export function normalizeVideoUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (
    value.startsWith('data:video') ||
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    /^https?:\/\//.test(value)
  ) {
    return value;
  }
  // public/ 下的画布内置演示视频，走前端静态资源，不要拼到 jimiaigo API 域名
  if (value.startsWith('/demo/')) {
    return value;
  }
  return normalizeImageUrl(value);
}

function requestJson(path, options) {
  return requestJimiaigo(path, {
    ...options,
    networkErrorMessage: '请求失败，无法连接到视频服务',
  });
}

function requestForm(path, { token, formData }) {
  return requestJimiaigoForm(path, {
    token,
    body: formData,
    fallback: '上传失败',
    networkErrorMessage: '上传失败，无法连接到视频服务',
  });
}

function buildReferenceImageUrls(referenceImages = []) {
  return (referenceImages || [])
    .map((image) => normalizeImageUrl(image.url || image.data || image.uploadedUrl))
    .filter(Boolean);
}

function buildVeoFrameImageUrl(image) {
  if (!image) return '';
  return normalizeImageUrl(image.url || image.data || image.uploadedUrl);
}

function buildVeoImages({ generationType, referenceImages = [], firstFrame, lastFrame }) {
  if (generationType === 'reference') {
    return buildReferenceImageUrls(referenceImages).slice(0, 3);
  }

  const first = buildVeoFrameImageUrl(firstFrame);
  const last = first ? buildVeoFrameImageUrl(lastFrame) : '';
  return [first, last].filter(Boolean);
}

function extractTaskId(data) {
  return data?.id || data?.projectId || data?.task_id || data?.taskId || data?.TaskID;
}

async function createSoraTask({ token, prompt, settings, referenceImages }) {
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('model', settings.model);
  formData.append('route', settings.route || DEFAULT_VIDEO_ROUTE);
  formData.append('duration', String(settings.duration));
  formData.append('orientation', settings.orientation);
  formData.append('size', settings.size);

  buildReferenceImageUrls(referenceImages).forEach((url) => formData.append('images', url));

  const data = await requestForm('/api/video/unified/create', { token, formData });
  const taskId = extractTaskId(data);
  if (!taskId) {
    throw new Error('视频任务创建成功，但未返回任务 ID');
  }

  return { taskId: String(taskId), provider: 'sora' };
}

async function createVeoTask({ token, prompt, settings, referenceImages, veoFrames = {} }) {
  const generationType = settings.generationType === 'reference' ? 'reference' : 'frame';
  const images = buildVeoImages({
    generationType,
    referenceImages,
    firstFrame: veoFrames.firstFrame,
    lastFrame: veoFrames.lastFrame,
  });
  const aspectRatio = settings.ratio === 'landscape' ? '16:9' : settings.ratio === 'portrait' ? '9:16' : settings.ratio;

  const data = await requestJson('/api/video/veo/frames/create', {
    token,
    method: 'POST',
    body: {
      model: settings.model,
      prompt,
      aspect_ratio: aspectRatio,
      duration: Number(settings.duration) || 8,
      resolution: settings.resolution,
      images,
      generation_type: generationType,
    },
  });

  const taskId = extractTaskId(data);
  if (!taskId) {
    throw new Error('VEO 任务创建成功，但未返回任务 ID');
  }

  const veoSource = data?.source === 'SC_VEO' ? 'SC_VEO' : 'KYY_VEO';

  return {
    taskId: String(taskId),
    provider: 'veo',
    queryModel: settings.model,
    veoSource,
  };
}

async function createOmniTask({ token, prompt, settings, referenceImages }) {
  const data = await requestJson('/api/video/gemini/create', {
    token,
    method: 'POST',
    body: {
      model: settings.model,
      prompt,
      duration: Number(settings.duration) || 6,
      resolution: settings.resolution,
      aspect_ratio: settings.ratio,
      image_urls: buildReferenceImageUrls(referenceImages),
    },
  });

  const taskId = extractTaskId(data);
  if (!taskId) {
    throw new Error('Omni 任务创建成功，但未返回任务 ID');
  }

  return { taskId: String(taskId), provider: 'omni', queryModel: settings.model };
}

export function pickSeedanceAssetUrl(asset) {
  if (!asset) return '';
  const url = String(asset.url || asset.assetUrl || '').trim();
  if (url.startsWith('asset://')) return url;
  if (asset.assetId) return `asset://${asset.assetId}`;
  return '';
}

export function resolveSeedanceMediaPreviewUrl(item, mediaType = 'video') {
  if (!item) return '';
  const candidates = [
    item.previewUrl,
    item.preview,
    item.originalUrl,
    item.original_url,
    item.url,
    item.data,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const raw of candidates) {
    if (raw.startsWith('asset://')) continue;
    const resolved = mediaType === 'image' ? normalizeImageUrl(raw) : normalizeVideoUrl(raw);
    if (resolved) return resolved;
  }
  return '';
}

function pickSeedancePreviewUrl(asset) {
  const mediaType = asset?.type === 'image' ? 'image' : asset?.type === 'audio' ? 'audio' : 'video';
  return resolveSeedanceMediaPreviewUrl(asset, mediaType);
}

function buildSeedanceReferencePayload(referenceImages = []) {
  const referenceImageUrls = [];
  const referenceImageAssets = [];

  (referenceImages || []).forEach((image) => {
    const assetUrl = pickSeedanceAssetUrl(image);
    const previewUrl = pickSeedancePreviewUrl(image) || buildVeoFrameImageUrl(image);
    if (previewUrl) referenceImageUrls.push(previewUrl);
    if (assetUrl) referenceImageAssets.push(assetUrl);
  });

  return { referenceImageUrls, referenceImageAssets };
}

export async function getSd2ManxueAssetList({
  token,
  page = 1,
  pageSize = 24,
  mediaType = 'image',
  status = 'Active',
}) {
  const data = await requestJson('/api/video/sd2manxue/asset/list', {
    token,
    query: {
      page,
      page_size: pageSize,
      media_type: mediaType,
      status,
    },
  });
  const list = Array.isArray(data?.list) ? data.list : [];
  return {
    list: list.map((item) => {
      const mapped = {
        id: item.assetId || item.id,
        assetId: item.assetId || item.id,
        url: item.assetId ? `asset://${item.assetId}` : '',
        originalUrl: item.originalUrl || item.original_url || '',
        previewUrl: item.previewUrl || item.preview_url || item.originalUrl || item.original_url || '',
        name: item.name || '素材',
        duration: item.duration,
        status: item.status || status,
        type: mediaType,
      };
      return {
        ...mapped,
        previewUrl: resolveSeedanceMediaPreviewUrl(mapped, mediaType),
      };
    }),
    total: data?.total || list.length,
  };
}

export async function submitSd2ManxueAudit({ token, mediaType = 'image', urls = [] }) {
  const payload = { audioUrls: [], imageUrls: [], videoUrls: [] };
  const list = (urls || []).map((url) => String(url || '').trim()).filter(Boolean);
  if (mediaType === 'video') payload.videoUrls = list;
  else if (mediaType === 'audio') payload.audioUrls = list;
  else payload.imageUrls = list;

  return requestJson('/api/video/sd2manxue/audit/submit', {
    token,
    method: 'POST',
    body: payload,
    fallback: '提交素材审核失败',
  });
}

export async function querySd2ManxueAuditStatus({ token, assetIds = [] }) {
  return requestJson('/api/video/sd2manxue/audit/status', {
    token,
    method: 'POST',
    body: { assetIds },
    fallback: '查询审核状态失败',
  });
}

function auditWait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function uploadAndAuditSeedanceAssets({ token, mediaType = 'image', files = [] }) {
  const uploadedUrls = [];
  for (const file of files) {
    const uploaded = await uploadAsset({ token, file });
    const url = mediaType === 'image' ? normalizeImageUrl(uploaded) : normalizeVideoUrl(uploaded);
    if (url) uploadedUrls.push(url);
  }
  if (uploadedUrls.length === 0) {
    throw new Error('上传失败，未获得有效文件地址');
  }

  const data = await submitSd2ManxueAudit({ token, mediaType, urls: uploadedUrls });
  const items = Array.isArray(data?.items) ? data.items : [];
  const assetIds = items.map((item) => item.assetId).filter(Boolean);
  if (assetIds.length === 0) {
    throw new Error('提交审核失败，未返回素材 ID');
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await auditWait(2000);
    const statusData = await querySd2ManxueAuditStatus({ token, assetIds });
    const statusItems = Array.isArray(statusData?.items) ? statusData.items : [];
    const allActive =
      statusItems.length > 0 && statusItems.every((item) => item.status === 'Active');
    const hasFailed = statusItems.some(
      (item) => item.status === 'Failed' || item.status === 'Rejected'
    );
    if (allActive) {
      return { passed: true, assetIds };
    }
    if (hasFailed) {
      throw new Error('素材审核未通过');
    }
  }

  return { passed: false, assetIds };
}

async function createSeedanceManxueTask({
  token,
  prompt,
  settings,
  referenceImages,
  seedanceInputs = {},
}) {
  const { referenceImageUrls, referenceImageAssets } = buildSeedanceReferencePayload(referenceImages);
  const firstFrame = seedanceInputs.firstFrame;
  const lastFrame = seedanceInputs.lastFrame;
  const firstAsset = pickSeedanceAssetUrl(firstFrame);
  const lastAsset = pickSeedanceAssetUrl(lastFrame);
  const firstPreview = pickSeedancePreviewUrl(firstFrame) || buildVeoFrameImageUrl(firstFrame);
  const lastPreview = pickSeedancePreviewUrl(lastFrame) || buildVeoFrameImageUrl(lastFrame);
  const referenceVideos = (seedanceInputs.referenceVideos || [])
    .map(pickSeedanceAssetUrl)
    .filter(Boolean);
  const referenceAudios = (seedanceInputs.referenceAudios || [])
    .map(pickSeedanceAssetUrl)
    .filter(Boolean);

  const data = await requestJson('/api/video/sd2manxue/create', {
    token,
    method: 'POST',
    body: {
      model: settings.apiModel || settings.model,
      prompt,
      duration: Number(settings.duration) || 5,
      ratio: settings.ratio || '16:9',
      first_image: firstAsset,
      image: firstAsset,
      last_image: lastAsset,
      lastFrameImage: lastAsset,
      first_image_url: firstPreview,
      last_image_url: lastPreview,
      reference_image_urls: referenceImageUrls,
      referenceImages: referenceImageAssets,
      referenceVideos,
      referenceAudios,
      video_ref_duration: Number(seedanceInputs.videoRefDuration) || 0,
    },
  });

  const taskId = data?.projectId || extractTaskId(data);
  if (!taskId) {
    throw new Error('Seedance 2.0 满血版任务创建成功，但未返回任务 ID');
  }

  return { taskId: String(taskId), provider: 'seedance-manxue' };
}

async function createGrokTask({ token, prompt, settings, referenceImages }) {
  const images = buildReferenceImageUrls(referenceImages);
  const data = await requestJson('/api/video/grok/create', {
    token,
    method: 'POST',
    body: {
      modelName: settings.model,
      prompt,
      duration: Number(settings.duration) || 6,
      quality: settings.quality,
      ratio: settings.ratio,
      imgUrl: images[0] || '',
    },
  });

  const taskId = extractTaskId(data);
  if (!taskId) {
    throw new Error('Grok 任务创建成功，但未返回任务 ID');
  }

  return { taskId: String(taskId), provider: 'grok' };
}

export async function createVideoGenerationTask({
  token,
  prompt,
  settings,
  referenceImages = [],
  veoFrames = {},
  seedanceInputs = {},
}) {
  const family = settings.family || DEFAULT_VIDEO_FAMILY;

  switch (family) {
    case 'veo':
      return createVeoTask({ token, prompt, settings, referenceImages, veoFrames });
    case 'omni':
      return createOmniTask({ token, prompt, settings, referenceImages });
    case 'seedance':
      return createSeedanceManxueTask({ token, prompt, settings, referenceImages, seedanceInputs });
    case 'grok':
      return createGrokTask({ token, prompt, settings, referenceImages });
    case 'sora':
    default:
      return createSoraTask({ token, prompt, settings, referenceImages });
  }
}

function pickTaskVideoUrl(task) {
  if (!task) return '';
  return normalizeVideoUrl(task.videoPath || task.video_path || '');
}

function normalizeTaskStatus(status) {
  return String(status ?? '').trim().toLowerCase();
}

function isTaskSuccess(status) {
  const normalized = normalizeTaskStatus(status);
  return TASK_SUCCESS_STATUS.has(normalized);
}

function isTaskFailed(status) {
  const normalized = normalizeTaskStatus(status);
  return TASK_FAILED_STATUS.has(normalized);
}

function isTaskPending(status) {
  const normalized = normalizeTaskStatus(status);
  return !normalized || TASK_PENDING_STATUS.has(normalized);
}

/** 后端创建视频后异步写入 ai_tasks，首轮轮询可能返回「任务不存在」 */
function isTaskRecordPendingError(error) {
  const message = String(error?.message || error || '');
  return /任务不存在/.test(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getTaskDetail({ token, taskId, allowPendingRecord = false } = {}) {
  try {
    return await requestJson(`/api/task/${encodeURIComponent(taskId)}`, { token });
  } catch (error) {
    if (allowPendingRecord && isTaskRecordPendingError(error)) {
      return null;
    }
    throw error;
  }
}

export async function waitForVideoTask({
  token,
  taskId,
  maxAttempts = 400,
  intervalMs = 3000,
  onProgress,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const task = await getTaskDetail({ token, taskId, allowPendingRecord: true });

    if (!task) {
      if (onProgress) {
        onProgress({
          status: 'pending',
          progress: 0,
        });
      }
      // 落库有延迟：前几次短间隔重试，之后按正常轮询间隔
      await wait(attempt < 12 ? 500 : intervalMs);
      continue;
    }

    const status = task?.status;

    if (onProgress) {
      onProgress({
        status,
        progress: Number(task?.progress) || 0,
      });
    }

    if (isTaskSuccess(status)) {
      const videoUrl = pickTaskVideoUrl(task);
      if (!videoUrl) {
        throw new Error('视频任务已完成，但未返回视频地址');
      }
      return videoUrl;
    }

    if (isTaskFailed(status)) {
      throw new Error(task?.remark || '视频生成失败');
    }

    if (!isTaskPending(status)) {
      throw new Error(`未知的视频任务状态: ${status || 'unknown'}`);
    }

    await wait(intervalMs);
  }

  throw new Error('视频生成超时，请稍后重试');
}

export async function downloadVideoFile(url, filename = 'video.mp4') {
  const href = normalizeVideoUrl(url);
  if (!href) throw new Error('没有可下载的视频');

  try {
    const response = await fetch(href);
    if (!response.ok) throw new Error('下载失败');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
  }
}
