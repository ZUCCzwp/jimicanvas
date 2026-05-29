import { PLACEHOLDER_IMAGE } from './constants';

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

export function getImageNodeOutputUrl(node) {
  if (!node || node.type !== 'image') return '';

  const images = Array.isArray(node.images) && node.images.length > 0 ? node.images : [];
  if (images[0]) return images[0];

  const content = String(node.content || '').trim();
  if (
    content &&
    content !== PLACEHOLDER_IMAGE &&
    (content.startsWith('data:image') ||
      /^https?:\/\//.test(content) ||
      content.startsWith('/demo/'))
  ) {
    return content;
  }

  return '';
}

export function formatImageInputLabel(node, maxLength = 18) {
  if (!node) return '图片节点';

  const title = String(node.title || '').trim();
  if (title && title !== '图片节点') {
    return title.length <= maxLength ? title : `${title.slice(0, maxLength)}…`;
  }

  return '图片节点';
}

export function resolveVideoPrompt(node, nodes = [], connections = []) {
  const ownPrompt = String(node?.prompt || '').trim();
  if (ownPrompt) return ownPrompt;

  return getTextInputLinks(node.id, nodes, connections)
    .map((item) => getTextInputPreview(item.node))
    .filter(Boolean)
    .join('\n\n');
}

export function resolveVideoReferenceImages(node, nodes = [], connections = []) {
  const assetRefs = Array.isArray(node?.referenceImages) ? [...node.referenceImages] : [];
  const connected = getImageInputLinks(node.id, nodes, connections)
    .map((item) => {
      const url = getImageNodeOutputUrl(item.node);
      if (!url) return null;
      return {
        id: `conn-${item.linkId}`,
        url,
        name: item.node?.title || '图片节点',
        source: 'connection',
      };
    })
    .filter(Boolean);

  const seen = new Set();
  return [...connected, ...assetRefs].filter((item) => {
    const key = item.url || item.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function hasVideoPromptSource(node, nodes = [], connections = []) {
  return Boolean(resolveVideoPrompt(node, nodes, connections));
}
