import {
  PLACEHOLDER_IMAGE,
  DEFAULT_VIDEO_URL,
  getImageReferenceMax,
  inferVideoFamily,
  getVideoReferenceImageMax,
  VIDEO_FRAME_IMAGE_CONNECTION_MAX,
} from './constants';
import { isDefaultDemoImageUrl, getImageNodeDisplayImages } from './imageNodeLayout';
import { isVideoContent } from './canvas';

export function getIncomingConnections(nodeId, connections = []) {
  return connections.filter((link) => link.toNodeId === nodeId);
}

export function getTextInputLinks(nodeId, nodes = [], connections = []) {
  return getIncomingConnections(nodeId, connections)
    .map((link) => ({
      linkId: link.id,
      node: nodes.find((item) => item.id === link.fromNodeId),
    }))
    .filter((item) => item.node?.type === 'note');
}

export function getTextInputPreview(node) {
  if (!node) return '';
  return String(node.prompt || node.content || node.title || '').trim();
}

export function formatTextInputLabel(node, maxLength = 18) {
  if (!node) return '空文本';

  const title = String(node.title || '').trim();
  const preview = getTextInputPreview(node).replace(/\s+/g, ' ');
  const label =
    title && title !== '文本节点'
      ? title
      : preview || '文本节点';

  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength)}…`;
}

export function resolveImagePrompt(node, nodes = [], connections = []) {
  const ownPrompt = String(node?.prompt || '').trim();
  if (ownPrompt) return ownPrompt;

  return getTextInputLinks(node.id, nodes, connections)
    .map((item) => getTextInputPreview(item.node))
    .filter(Boolean)
    .join('\n\n');
}

export function resolveAudioPrompt(node, nodes = [], connections = []) {
  return resolveImagePrompt(node, nodes, connections);
}

export function hasImagePromptSource(node, nodes = [], connections = []) {
  return Boolean(resolveImagePrompt(node, nodes, connections));
}

export function getImageInputLinks(nodeId, nodes = [], connections = []) {
  return getIncomingConnections(nodeId, connections)
    .map((link) => ({
      linkId: link.id,
      node: nodes.find((item) => item.id === link.fromNodeId),
    }))
    .filter((item) => item.node?.type === 'image');
}

export function getVideoInputLinks(nodeId, nodes = [], connections = []) {
  return getIncomingConnections(nodeId, connections)
    .map((link) => ({
      linkId: link.id,
      node: nodes.find((item) => item.id === link.fromNodeId),
    }))
    .filter((item) => item.node?.type === 'video');
}

export function getImageNodeOutputUrl(node) {
  if (!node || node.type !== 'image') return '';
  const display = getImageNodeDisplayImages(node);
  return display[0] || '';
}

export function getImageNodeReferenceUrl(node) {
  const url = getImageNodeOutputUrl(node);
  if (!url || isDefaultDemoImageUrl(url)) return '';
  return url;
}

export function isDefaultDemoVideoUrl(url) {
  const value = String(url || '').trim();
  if (!value || !DEFAULT_VIDEO_URL) return false;
  return value === DEFAULT_VIDEO_URL || value.endsWith(DEFAULT_VIDEO_URL);
}

export function getVideoNodeOutputUrl(node) {
  if (!node || node.type !== 'video') return '';

  const videos = Array.isArray(node.videos) && node.videos.length > 0 ? node.videos : [];
  if (videos[0]) return videos[0];

  const content = String(node.content || '').trim();
  if (content && isVideoContent(content)) return content;

  return '';
}

export function getVideoNodeReferenceUrl(node) {
  const url = getVideoNodeOutputUrl(node);
  if (!url || isDefaultDemoVideoUrl(url)) return '';
  return url;
}

export function resolveNoteVideoInputUrls(videoInputLinks = []) {
  return (videoInputLinks || [])
    .map(({ linkId, node }) => {
      const url = getVideoNodeReferenceUrl(node);
      return url ? { linkId, node, url } : null;
    })
    .filter(Boolean);
}

export function isVideoToPromptNode(node, videoInputLinks = []) {
  if (!node || node.type !== 'note') return false;
  if (node.workflowMode === 'video-to-prompt') return true;
  if (node.workflowMode === 'image-to-prompt') return false;
  return resolveNoteVideoInputUrls(videoInputLinks).length > 0;
}

export function resolveNoteImageInputUrls(imageInputLinks = []) {
  return (imageInputLinks || [])
    .map(({ linkId, node }) => {
      const url = getImageNodeReferenceUrl(node);
      return url ? { linkId, node, url } : null;
    })
    .filter(Boolean);
}

export function isImageToPromptNode(node, imageInputLinks = []) {
  if (!node || node.type !== 'note') return false;
  if (node.workflowMode === 'video-to-prompt') return false;
  if (node.workflowMode === 'image-to-prompt') return true;
  return resolveNoteImageInputUrls(imageInputLinks).length > 0;
}

function dedupeReferenceImages(references = []) {
  const seen = new Set();
  return references.filter((item) => {
    const key = item.url || item.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeImageReferenceImages(node, imageInputLinks = []) {
  const maxRef = getImageReferenceMax(node?.imageModel);
  const assetRefs = Array.isArray(node?.referenceImages) ? [...node.referenceImages] : [];
  const connected = (imageInputLinks || [])
    .map((item) => {
      const url = getImageNodeReferenceUrl(item.node);
      if (!url) return null;
      return {
        id: `conn-${item.linkId}`,
        linkId: item.linkId,
        url,
        name: formatImageInputLabel(item.node),
        source: 'connection',
      };
    })
    .filter(Boolean);

  return dedupeReferenceImages([...connected, ...assetRefs]).slice(0, maxRef);
}

export function resolveImageReferenceImages(node, nodes = [], connections = []) {
  return mergeImageReferenceImages(node, getImageInputLinks(node.id, nodes, connections));
}

export function formatImageInputLabel(node, maxLength = 18) {
  if (!node) return '图片节点';

  const title = String(node.title || '').trim();
  if (title && title !== '图片节点') {
    return title.length <= maxLength ? title : `${title.slice(0, maxLength)}…`;
  }

  return '图片节点';
}

export function formatVideoInputLabel(node, maxLength = 18) {
  if (!node) return '视频节点';

  const title = String(node.title || '').trim();
  if (title && title !== '视频节点') {
    return title.length <= maxLength ? title : `${title.slice(0, maxLength)}…`;
  }

  return '视频节点';
}

export function resolveVideoPrompt(node, nodes = [], connections = []) {
  const ownPrompt = String(node?.prompt || '').trim();
  if (ownPrompt) return ownPrompt;

  return getTextInputLinks(node.id, nodes, connections)
    .map((item) => getTextInputPreview(item.node))
    .filter(Boolean)
    .join('\n\n');
}

export function isVideoFrameImageMode(node) {
  const family = inferVideoFamily(node);
  if (family === 'veo') {
    return (node?.videoGenerationType || 'frame') === 'frame';
  }
  if (family === 'seedance') {
    const refs = Array.isArray(node?.referenceImages) ? node.referenceImages : [];
    return refs.length === 0;
  }
  return false;
}

export function isVideoReferenceImageMode(node) {
  return !isVideoFrameImageMode(node);
}

export function getVideoImageConnectionMax(node) {
  if (isVideoFrameImageMode(node)) {
    return VIDEO_FRAME_IMAGE_CONNECTION_MAX;
  }
  return getVideoReferenceImageMax(node);
}

export function buildVideoConnectedImageAsset(linkItem) {
  const url = getImageNodeReferenceUrl(linkItem.node);
  if (!url) return null;
  return {
    id: `conn-${linkItem.linkId}`,
    linkId: linkItem.linkId,
    url,
    name: formatImageInputLabel(linkItem.node),
    source: 'connection',
  };
}

export function resolveVideoConnectedImageAssets(imageInputLinks = []) {
  return (imageInputLinks || []).map(buildVideoConnectedImageAsset).filter(Boolean);
}

export function resolveVideoToolbarReferences(node, imageInputLinks = []) {
  const assetRefs = Array.isArray(node?.referenceImages) ? [...node.referenceImages] : [];
  if (!isVideoReferenceImageMode(node)) {
    return dedupeReferenceImages(assetRefs);
  }

  const connected = resolveVideoConnectedImageAssets(imageInputLinks);
  const max = getVideoReferenceImageMax(node);

  return dedupeReferenceImages([...connected, ...assetRefs]).slice(0, max);
}

export function resolveVideoToolbarFrames(node, imageInputLinks = []) {
  const connected = resolveVideoConnectedImageAssets(imageInputLinks);
  let connIdx = 0;

  let firstFrame = node?.videoFirstFrame || null;
  let lastFrame = node?.videoLastFrame || null;
  let firstConnectionLinkId = null;
  let lastConnectionLinkId = null;

  if (!firstFrame && connected[connIdx]) {
    firstFrame = connected[connIdx];
    firstConnectionLinkId = connected[connIdx].linkId;
    connIdx += 1;
  }
  if (!lastFrame && connected[connIdx]) {
    lastFrame = connected[connIdx];
    lastConnectionLinkId = connected[connIdx].linkId;
  }

  return {
    firstFrame,
    lastFrame,
    firstConnectionLinkId,
    lastConnectionLinkId,
  };
}

export function resolveVideoGenerationFrames(node, nodes = [], connections = []) {
  const imageInputLinks = getImageInputLinks(node.id, nodes, connections);
  const { firstFrame, lastFrame } = resolveVideoToolbarFrames(node, imageInputLinks);
  return { firstFrame, lastFrame };
}

export function validateVideoImageConnection(videoNode, imageInputLinks = []) {
  if (!videoNode || videoNode.type !== 'video') return null;

  const max = getVideoImageConnectionMax(videoNode);
  if (imageInputLinks.length >= max) {
    if (isVideoFrameImageMode(videoNode)) {
      return `首尾帧模式最多连接 ${VIDEO_FRAME_IMAGE_CONNECTION_MAX} 张图片`;
    }
    return `参考图模式最多连接 ${max} 张图片`;
  }

  return null;
}

export function resolveVideoReferenceImages(node, nodes = [], connections = []) {
  const imageInputLinks = getImageInputLinks(node.id, nodes, connections);
  return resolveVideoToolbarReferences(node, imageInputLinks).map((item) => ({
    id: item.id,
    linkId: item.linkId,
    url: item.url,
    name: item.name,
    source: item.source,
  }));
}

export function hasVideoPromptSource(node, nodes = [], connections = []) {
  return Boolean(resolveVideoPrompt(node, nodes, connections));
}
