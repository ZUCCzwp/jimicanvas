import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_RATIO, DEFAULT_IMAGE_RESOLUTION } from './constants';
import { getChatApiBaseUrl, requestJimiaigo, requestJimiaigoForm } from './jimiaigoApi';

const FINISHED_STATUS = new Set(['success', 'completed']);
const FAILED_STATUS = new Set(['failed', 'error']);

export function normalizeImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  if (value.startsWith('//')) {
    return `${window.location.protocol}${value}`;
  }
  // public/demo 下的内置示例图，走前端静态资源
  if (value.startsWith('/demo/')) {
    return value;
  }

  const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');
  if (value.startsWith('/')) {
    return `${baseUrl}${value}`;
  }
  return `${baseUrl}/${value}`;
}

function requestJson(path, options) {
  return requestJimiaigo(path, {
    ...options,
    networkErrorMessage: '请求失败，无法连接到图片服务',
  });
}

function requestForm(path, { token, formData }) {
  return requestJimiaigoForm(path, {
    token,
    body: formData,
    fallback: '上传失败',
    networkErrorMessage: '上传失败，无法连接到图片服务',
  });
}

function imagePathForModel(model) {
  if (model === 'gpt-image-2') return '/api/image/gpt-image-2';
  if (model === 'nanobananapro') return '/api/image/nanobananapro';
  return '/api/image/nanobanana2';
}

function getLocalAssetUrl(item) {
  if (!item) return '';
  return item.path || item.image || item.url || item.image_url || '';
}

function getOneMonthDateRange() {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const format = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };
  return { start: format(start), end: format(now) };
}

function dataUrlToInlineData(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime_type: match[1],
    data: match[2],
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function urlToInlineData(url) {
  if (String(url || '').startsWith('data:')) {
    return dataUrlToInlineData(url);
  }

  const response = await fetch(normalizeImageUrl(url), { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`参考图读取失败: ${response.statusText}`);
  }
  const blob = await response.blob();
  const dataUrl = await fileToDataUrl(blob);
  return dataUrlToInlineData(dataUrl);
}

async function buildReferenceParts(referenceImages = []) {
  const parts = [];
  for (const image of referenceImages) {
    try {
      const inlineData = image.inlineData || (image.data ? dataUrlToInlineData(image.data) : null);
      const resolved = inlineData || (image.url ? await urlToInlineData(image.url) : null);
      if (resolved) {
        parts.push({ inline_data: resolved });
      }
    } catch (error) {
      console.warn('跳过无法读取的参考图', image?.url || image?.name || image?.id || '', error);
    }
  }
  return parts;
}

async function buildImageRequest({ prompt, model, ratio, resolution, referenceImages = [] }) {
  if (model === 'gpt-image-2') {
    return {
      model,
      prompt,
      size: ratio || DEFAULT_IMAGE_RATIO,
      resolution: resolution || DEFAULT_IMAGE_RESOLUTION,
      n: 1,
      images: referenceImages.map((image) => normalizeImageUrl(image.url || image.data)).filter(Boolean),
    };
  }

  const referenceParts = await buildReferenceParts(referenceImages);
  return {
    model: `${model || DEFAULT_IMAGE_MODEL}-${(resolution || DEFAULT_IMAGE_RESOLUTION).toLowerCase()}`,
    contents: [{ role: 'user', parts: [{ text: prompt }, ...referenceParts] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: ratio || DEFAULT_IMAGE_RATIO,
        imageSize: (resolution || DEFAULT_IMAGE_RESOLUTION).toUpperCase(),
      },
    },
  };
}

export async function createImageGenerationTask({ token, prompt, model, ratio, resolution, referenceImages }) {
  const data = await requestJson(imagePathForModel(model), {
    token,
    method: 'POST',
    body: await buildImageRequest({ prompt, model, ratio, resolution, referenceImages }),
  });

  const taskId = data?.task_id || data?.taskId || data?.id;
  if (!taskId) {
    throw new Error('图片任务创建成功，但未返回任务 ID');
  }

  return taskId;
}

export async function readImageFile(file) {
  const dataUrl = await fileToDataUrl(file);
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || '本地图片',
    url: dataUrl,
    data: dataUrl,
    inlineData: dataUrlToInlineData(dataUrl),
    type: 'image',
  };
}

export async function readVideoFile(file) {
  const dataUrl = await fileToDataUrl(file);
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || '本地视频',
    url: dataUrl,
    data: dataUrl,
    type: 'video',
  };
}

export async function uploadAsset({ token, file }) {
  const formData = new FormData();
  formData.append('file', file);
  const data = await requestForm('/api/asset/upload', { token, formData });
  return normalizeImageUrl(data?.url || '');
}

export async function getAssetList({
  token,
  page = 1,
  pageSize = 24,
  source = 'local',
  mediaType = 'image',
}) {
  if (source === 'ai') {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    const data = await requestJson(`/api/imageTask/list?${params.toString()}`, { token });
    const list = data?.list || [];
    return {
      list: list.flatMap((task) =>
        (task.result_images || []).map((url, index) => ({
          id: `${task.task_id || task.id}-${index}`,
          url: normalizeImageUrl(url),
          name: task.prompt || 'AI 图片',
          type: 'image',
          createdAt: task.created_at,
        }))
      ),
      total: data?.total || list.length,
    };
  }

  const { start, end } = getOneMonthDateRange();
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    media_type: mediaType,
    start_time: start,
    end_time: end,
  });
  const data = await requestJson(`/api/asset/list?${params.toString()}`, { token });
  const list = Array.isArray(data) ? data : data?.list || [];
  const assetLabel = mediaType === 'video' ? '视频资产' : '图片资产';
  return {
    list: list.map((item) => ({
      ...item,
      id: item.id || item.uuid,
      url: getLocalAssetUrl(item),
      name: item.name || item.filename || assetLabel,
      type: mediaType,
      createdAt: item.created_at || item.createdAt,
    })),
    total: data?.total || list.length,
  };
}

export async function getImageTask({ token, taskId }) {
  return requestJson(`/api/imageTask/${encodeURIComponent(taskId)}`, { token });
}

export async function waitForImageTask({
  token,
  taskId,
  maxAttempts = 400,
  intervalMs = 3000,
  onProgress,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const task = await getImageTask({ token, taskId });
    const status = String(task?.status || '').toLowerCase();

    if (onProgress) {
      onProgress({
        status: task?.status,
        progress: Number(task?.progress) || 0,
      });
    }

    if (FINISHED_STATUS.has(status)) {
      const resultImages = Array.isArray(task?.result_images)
        ? task.result_images
        : task?.result_images
          ? [task.result_images]
          : [];
      const images = resultImages.filter(Boolean).map(normalizeImageUrl);
      if (images.length === 0) {
        throw new Error('图片任务已完成，但未返回图片');
      }
      return images;
    }

    if (FAILED_STATUS.has(status)) {
      throw new Error(task?.fail_reason || task?.remark || '图片生成失败');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('图片生成超时，请稍后重试');
}

export async function splitImageIntoGrid(imageUrl, cols, rows) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const cellWidth = img.naturalWidth / cols;
        const cellHeight = img.naturalHeight / rows;
        const result = [];
        
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const canvas = document.createElement('canvas');
            canvas.width = cellWidth;
            canvas.height = cellHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(
              img,
              c * cellWidth,
              r * cellHeight,
              cellWidth,
              cellHeight,
              0,
              0,
              cellWidth,
              cellHeight
            );
            result.push(canvas.toDataURL('image/jpeg', 0.85));
          }
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('图片加载失败，请检查是否跨域或链接已失效'));
    img.src = normalizeImageUrl(imageUrl);
  });
}

export function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}


