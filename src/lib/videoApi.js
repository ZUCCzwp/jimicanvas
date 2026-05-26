import { DEFAULT_VIDEO_FAMILY, DEFAULT_VIDEO_ROUTE } from './constants';
import { getChatApiBaseUrl } from './chatApi';
import { normalizeImageUrl } from './imageApi';

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
  return normalizeImageUrl(url);
}

async function requestJson(path, { token, method = 'GET', body } = {}) {
  const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('请求失败，无法连接到视频服务');
    }
    throw error;
  }

  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || (parsed && parsed.code && parsed.code !== 20000)) {
    throw new Error(parsed?.msg || parsed?.message || rawText || '请求失败');
  }

  return parsed?.data ?? parsed;
}

async function requestForm(path, { token, formData } = {}) {
  const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('上传失败，无法连接到视频服务');
    }
    throw error;
  }

  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || (parsed && parsed.code && parsed.code !== 20000)) {
    throw new Error(parsed?.msg || parsed?.message || rawText || '请求失败');
  }

  return parsed?.data ?? parsed;
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

async function createSeedanceStandardTask({ token, prompt, settings, referenceImages }) {
  const data = await requestJson('/api/video/seedance/2/create', {
    token,
    method: 'POST',
    body: {
      model: settings.model,
      prompt,
      duration: Number(settings.duration) || 5,
      resolution: settings.resolution,
      aspect_ratio: settings.ratio,
      image_urls: buildReferenceImageUrls(referenceImages),
    },
  });

  const taskId = extractTaskId(data);
  if (!taskId) {
    throw new Error('Seedance 任务创建成功，但未返回任务 ID');
  }

  return { taskId: String(taskId), provider: 'seedance', queryModel: settings.model };
}

async function createSeedanceManxueTask({ token, prompt, settings, referenceImages }) {
  const images = buildReferenceImageUrls(referenceImages);
  const data = await requestJson('/api/video/sd2manxue/create', {
    token,
    method: 'POST',
    body: {
      model: settings.apiModel || settings.model,
      prompt,
      duration: Number(settings.duration) || 5,
      ratio: settings.ratio || '16:9',
      first_image: images[0] || '',
      image: images[0] || '',
      first_image_url: images[0] || '',
      reference_image_urls: images,
      referenceImages: images,
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
}) {
  const family = settings.family || DEFAULT_VIDEO_FAMILY;

  switch (family) {
    case 'veo':
      return createVeoTask({ token, prompt, settings, referenceImages, veoFrames });
    case 'omni':
      return createOmniTask({ token, prompt, settings, referenceImages });
    case 'seedance':
      if (settings.provider === 'seedance-manxue') {
        return createSeedanceManxueTask({ token, prompt, settings, referenceImages });
      }
      return createSeedanceStandardTask({ token, prompt, settings, referenceImages });
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

export async function getTaskDetail({ token, taskId }) {
  return requestJson(`/api/task/${encodeURIComponent(taskId)}`, { token });
}

export async function waitForVideoTask({
  token,
  taskId,
  maxAttempts = 400,
  intervalMs = 3000,
  onProgress,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const task = await getTaskDetail({ token, taskId });
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

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('视频生成超时，请稍后重试');
}
