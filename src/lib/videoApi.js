import { DEFAULT_VIDEO_FAMILY, DEFAULT_VIDEO_ROUTE } from './constants';
import { getChatApiBaseUrl } from './chatApi';
import { normalizeImageUrl } from './imageApi';

const SORA_SUCCESS_STATUS = new Set([1, '1', 'success', 'completed']);
const SORA_FAILED_STATUS = new Set([2, '2', 'failed', 'error']);
const GENERIC_SUCCESS_STATUS = new Set(['success', 'completed', 'succeeded']);
const GENERIC_FAILED_STATUS = new Set(['failed', 'error', 'failure']);

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

async function createVeoTask({ token, prompt, settings, referenceImages }) {
  const images = buildReferenceImageUrls(referenceImages);
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
      generation_type: images.length > 0 ? 'reference' : 'frame',
    },
  });

  const taskId = extractTaskId(data);
  if (!taskId) {
    throw new Error('VEO 任务创建成功，但未返回任务 ID');
  }

  return { taskId: String(taskId), provider: 'veo', queryModel: settings.model };
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

export async function createVideoGenerationTask({ token, prompt, settings, referenceImages = [] }) {
  const family = settings.family || DEFAULT_VIDEO_FAMILY;

  switch (family) {
    case 'veo':
      return createVeoTask({ token, prompt, settings, referenceImages });
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

function pickVideoUrl(payload) {
  if (!payload) return '';
  return normalizeVideoUrl(
    payload.mediaUrl ||
      payload.media_url ||
      payload.video_url ||
      payload.videoUrl ||
      payload.originUrl ||
      payload.result?.video_url ||
      payload.result?.video_path ||
      payload.result?.videoUrl
  );
}

async function querySoraTask({ token, taskId }) {
  const params = new URLSearchParams({ projectId: taskId });
  return requestJson(`/api/video/sora2/result?${params.toString()}`, { token });
}

async function queryVeoTask({ token, taskId }) {
  return requestJson(`/api/video/query/${encodeURIComponent(taskId)}`, { token });
}

async function queryOmniTask({ token, taskId, model }) {
  const params = new URLSearchParams({ id: taskId, model: model || 'Gemini-Omini' });
  return requestJson(`/api/video/gemini/query?${params.toString()}`, { token });
}

async function querySeedanceStandardTask({ token, taskId, model }) {
  const params = new URLSearchParams({ id: taskId, model: model || 'doubao-seedance-2.0' });
  return requestJson(`/api/video/seedance/2/query?${params.toString()}`, { token });
}

async function querySeedanceManxueTask({ token, taskId }) {
  const params = new URLSearchParams({ projectId: taskId });
  return requestJson(`/api/video/sd2manxue/query?${params.toString()}`, { token });
}

async function queryGrokTask({ token, taskId }) {
  const params = new URLSearchParams({ id: taskId });
  return requestJson(`/api/video/grok/query?${params.toString()}`, { token });
}

export async function waitForVideoTask({
  token,
  taskId,
  provider = 'sora',
  queryModel,
  maxAttempts = 400,
  intervalMs = 3000,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (provider === 'sora') {
      const result = await querySoraTask({ token, taskId });
      const status = result?.status;

      if (SORA_SUCCESS_STATUS.has(status)) {
        const videoUrl = pickVideoUrl(result);
        if (!videoUrl) throw new Error('视频任务已完成，但未返回视频地址');
        return videoUrl;
      }

      if (SORA_FAILED_STATUS.has(status)) {
        throw new Error(result?.reason || '视频生成失败');
      }
    } else if (provider === 'veo') {
      const result = await queryVeoTask({ token, taskId });
      const status = String(result?.status || '').toLowerCase();

      if (GENERIC_SUCCESS_STATUS.has(status) || result?.video_url) {
        const videoUrl = pickVideoUrl(result);
        if (!videoUrl) throw new Error('VEO 任务已完成，但未返回视频地址');
        return videoUrl;
      }

      if (GENERIC_FAILED_STATUS.has(status)) {
        throw new Error(result?.error?.message || result?.error || 'VEO 视频生成失败');
      }
    } else if (provider === 'omni') {
      const result = await queryOmniTask({ token, taskId, model: queryModel });
      const status = String(result?.status || '').toLowerCase();

      if (GENERIC_SUCCESS_STATUS.has(status)) {
        const videoUrl = pickVideoUrl(result);
        if (!videoUrl) throw new Error('Omni 任务已完成，但未返回视频地址');
        return videoUrl;
      }

      if (GENERIC_FAILED_STATUS.has(status)) {
        throw new Error(result?.error?.message || result?.error || 'Omni 视频生成失败');
      }
    } else if (provider === 'seedance-manxue') {
      const result = await querySeedanceManxueTask({ token, taskId });
      const status = result?.status;

      if (SORA_SUCCESS_STATUS.has(status)) {
        const videoUrl = pickVideoUrl(result);
        if (!videoUrl) throw new Error('Seedance 2.0 满血版任务已完成，但未返回视频地址');
        return videoUrl;
      }

      if (SORA_FAILED_STATUS.has(status)) {
        throw new Error(result?.reason || 'Seedance 2.0 满血版视频生成失败');
      }
    } else if (provider === 'seedance') {
      const result = await querySeedanceStandardTask({ token, taskId, model: queryModel });
      const status = String(result?.status || '').toLowerCase();

      if (GENERIC_SUCCESS_STATUS.has(status)) {
        const videoUrl = pickVideoUrl(result);
        if (!videoUrl) throw new Error('Seedance 任务已完成，但未返回视频地址');
        return videoUrl;
      }

      if (GENERIC_FAILED_STATUS.has(status)) {
        throw new Error(result?.error?.message || result?.error || 'Seedance 视频生成失败');
      }
    } else if (provider === 'grok') {
      const result = await queryGrokTask({ token, taskId });
      const status = result?.status;

      if (SORA_SUCCESS_STATUS.has(status)) {
        const videoUrl = pickVideoUrl(result);
        if (!videoUrl) throw new Error('Grok 任务已完成，但未返回视频地址');
        return videoUrl;
      }

      if (SORA_FAILED_STATUS.has(status)) {
        throw new Error(result?.reason || 'Grok 视频生成失败');
      }
    } else {
      throw new Error(`暂不支持 ${provider} 的任务轮询`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('视频生成超时，请稍后重试');
}
