import { normalizeAudioUrl } from './audioApi';
import { normalizeImageUrl } from './imageApi';
import { normalizeVideoUrl } from './videoApi';

export function isLocalMediaUrl(value) {
  const str = String(value || '').trim();
  return str.startsWith('data:') || str.startsWith('blob:');
}

export async function localMediaUrlToFile(url, filename = 'asset.bin') {
  const value = String(url || '').trim();
  if (!isLocalMediaUrl(value)) {
    throw new Error('不是本地媒体地址');
  }
  const response = await fetch(value);
  const blob = await response.blob();
  const type = blob.type || 'application/octet-stream';
  return new File([blob], filename, { type });
}

export async function persistBlobAsset(blob, filename, { token, uploadAsset, normalizer }) {
  if (!token) {
    throw new Error('请先登录后再保存媒体到云端');
  }
  if (!blob || blob.size <= 0) {
    throw new Error('媒体文件无效');
  }
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  const uploadedUrl = await uploadAsset({ token, file });
  const normalized = normalizer(uploadedUrl || '');
  if (!normalized || isLocalMediaUrl(normalized)) {
    throw new Error('媒体上传失败，请重试');
  }
  return normalized;
}

export async function persistMediaUrl(
  url,
  { token, uploadAsset, normalizer, filename = 'asset.bin' }
) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (!isLocalMediaUrl(value)) {
    return normalizer(value);
  }
  const file = await localMediaUrlToFile(value, filename);
  return persistBlobAsset(file, filename, { token, uploadAsset, normalizer });
}

async function uploadLocalMediaMap(localUrls, ctx, buildFilename) {
  const remoteMap = new Map();
  let uploaded = 0;
  for (let index = 0; index < localUrls.length; index += 1) {
    const localUrl = localUrls[index];
    if (remoteMap.has(localUrl)) continue;
    remoteMap.set(
      localUrl,
      await persistMediaUrl(localUrl, {
        ...ctx,
        normalizer: buildFilename.normalizer,
        filename: buildFilename.forUrl(localUrl, index),
      })
    );
    uploaded += 1;
  }
  return { remoteMap, uploaded };
}

function collectUniqueLocalUrls(values = []) {
  const unique = [];
  values.forEach((value) => {
    const url = String(value || '').trim();
    if (!isLocalMediaUrl(url) || unique.includes(url)) return;
    unique.push(url);
  });
  return unique;
}

async function persistNodeMedia(node, ctx) {
  if (!node || typeof node !== 'object') {
    return { node, uploaded: 0 };
  }

  let uploaded = 0;
  const next = { ...node };

  if (node.type === 'image') {
    const localUrls = collectUniqueLocalUrls([
      ...(Array.isArray(node.images) ? node.images : []),
      node.content,
    ]);
    const { remoteMap, uploaded: count } = await uploadLocalMediaMap(localUrls, ctx, {
      normalizer: normalizeImageUrl,
      forUrl: (url, index) => `image_${node.id || 'node'}_${index + 1}.png`,
    });
    uploaded += count;

    next.images = (Array.isArray(node.images) ? node.images : [])
      .map((url) => remoteMap.get(url) || normalizeImageUrl(url))
      .filter(Boolean);
    next.content =
      remoteMap.get(node.content) || next.images[0] || normalizeImageUrl(node.content || '');
  }

  if (node.type === 'video') {
    const localUrls = collectUniqueLocalUrls([
      ...(Array.isArray(node.videos) ? node.videos : []),
      node.content,
    ]);
    const { remoteMap, uploaded: count } = await uploadLocalMediaMap(localUrls, ctx, {
      normalizer: normalizeVideoUrl,
      forUrl: (url, index) => `video_${node.id || 'node'}_${index + 1}.webm`,
    });
    uploaded += count;

    next.videos = (Array.isArray(node.videos) ? node.videos : [])
      .map((url) => remoteMap.get(url) || normalizeVideoUrl(url))
      .filter(Boolean);
    next.content =
      remoteMap.get(node.content) || next.videos[0] || normalizeVideoUrl(node.content || '');
  }

  if (node.type === 'audio') {
    const localUrls = collectUniqueLocalUrls([node.audioUrl, node.content]);
    if (localUrls.length > 0) {
      const { remoteMap, uploaded: count } = await uploadLocalMediaMap(localUrls, ctx, {
        normalizer: normalizeAudioUrl,
        forUrl: () => `audio_${node.id || 'node'}.webm`,
      });
      uploaded += count;
      const remote = remoteMap.get(localUrls[0]) || '';
      next.audioUrl = remote;
      next.content = remote;
    }
  }

  return { node: next, uploaded };
}

export async function persistDocumentsMedia(documents, { token, uploadAsset }) {
  if (!Array.isArray(documents) || !token || !uploadAsset) {
    return { documents, uploadedCount: 0 };
  }

  const ctx = { token, uploadAsset };
  let uploadedCount = 0;
  const nextDocuments = [];

  for (const doc of documents) {
    const nodes = Array.isArray(doc.nodes) ? doc.nodes : [];
    const nextNodes = [];
    for (const node of nodes) {
      const result = await persistNodeMedia(node, ctx);
      uploadedCount += result.uploaded;
      nextNodes.push(result.node);
    }
    nextDocuments.push({ ...doc, nodes: nextNodes });
  }

  return { documents: nextDocuments, uploadedCount };
}

function walkNodeMedia(node, visit) {
  if (!node || typeof node !== 'object') return;

  if (node.type === 'image') {
    (Array.isArray(node.images) ? node.images : []).forEach((url) => visit(url));
    visit(node.content);
  }

  if (node.type === 'video') {
    (Array.isArray(node.videos) ? node.videos : []).forEach((url) => visit(url));
    visit(node.content);
  }

  if (node.type === 'audio') {
    visit(node.audioUrl);
    visit(node.content);
  }
}

export function countLocalMediaInDocuments(documents) {
  if (!Array.isArray(documents)) return 0;
  let count = 0;
  for (const doc of documents) {
    for (const node of doc.nodes || []) {
      walkNodeMedia(node, (url) => {
        if (isLocalMediaUrl(url)) count += 1;
      });
    }
  }
  return count;
}

export function documentsMediaSignature(documents) {
  const urls = [];
  if (!Array.isArray(documents)) return '';
  for (const doc of documents) {
    for (const node of doc.nodes || []) {
      walkNodeMedia(node, (url) => {
        if (url) urls.push(String(url));
      });
    }
  }
  return urls.join('\n');
}
