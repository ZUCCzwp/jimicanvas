import { DEFAULT_AUDIO_MODEL, DEFAULT_AUDIO_SPEED, DEFAULT_AUDIO_VOICE } from './constants';
import { requestJimiaigo } from './jimiaigoApi';
import { normalizeImageUrl } from './imageApi';

function requestJson(path, options) {
  return requestJimiaigo(path, {
    ...options,
    networkErrorMessage: '请求失败，无法连接到音频服务',
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function normalizeAudioUrl(url) {
  return normalizeImageUrl(url);
}

export const AUDIO_FILE_ACCEPT = '.mp3,audio/mpeg,audio/mp3';

const MP3_FILE_PATTERN = /\.mp3(\?.*)?$/i;
const MP3_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp3']);

export function isAudioAssetUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  if (value.startsWith('data:audio/mpeg') || value.startsWith('data:audio/mp3')) return true;
  return MP3_FILE_PATTERN.test(value);
}

export function isAudioAssetRecord(asset) {
  if (!asset) return false;
  const url = asset.url || asset.path || asset.image_url || '';
  return isAudioAssetUrl(url);
}

export function isAudioFile(file) {
  if (!file) return false;
  const name = String(file.name || '').trim().toLowerCase();
  const mimeType = String(file.type || '').toLowerCase();

  if (/\.(mp4|m4v|mov|webm|avi|mkv)(\?.*)?$/i.test(name)) return false;
  if (mimeType.startsWith('video/')) return false;
  if (mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a') return false;

  if (MP3_MIME_TYPES.has(mimeType)) return true;
  return MP3_FILE_PATTERN.test(name);
}

export function filterAudioFiles(files = []) {
  return Array.from(files).filter(isAudioFile);
}

export async function readAudioFile(file) {
  if (!isAudioFile(file)) {
    throw new Error('请选择 MP3 音频文件');
  }
  const dataUrl = await fileToDataUrl(file);
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || '本地音频',
    url: dataUrl,
    data: dataUrl,
    type: 'audio',
  };
}

export async function createSpeech({
  token,
  input,
  voice = DEFAULT_AUDIO_VOICE,
  responseFormat = 'mp3',
  speed = DEFAULT_AUDIO_SPEED,
}) {
  const data = await requestJson('/api/audio/speech', {
    token,
    method: 'POST',
    body: {
      input,
      voice,
      response_format: responseFormat,
      speed,
      model: DEFAULT_AUDIO_MODEL,
    },
  });

  const url = normalizeAudioUrl(data?.url || '');
  if (!url) {
    throw new Error('语音合成成功，但未返回音频地址');
  }

  return url;
}
