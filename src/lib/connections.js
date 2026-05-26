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

export function hasImagePromptSource(node, nodes = [], connections = []) {
  return Boolean(resolveImagePrompt(node, nodes, connections));
}
