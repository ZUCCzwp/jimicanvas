import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  DEFAULT_IMAGE_COUNT,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_RATIO,
  DEFAULT_IMAGE_RESOLUTION,
  DEFAULT_VIDEO_URL,
  PLACEHOLDER_IMAGE,
} from './constants';

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createNode(type, x, y) {
  const id = uid('node');
  if (type === 'image') {
    return {
      id,
      type,
      title: '图片节点',
      prompt: '',
      content: PLACEHOLDER_IMAGE,
      images: [],
      referenceImages: [],
      imageModel: DEFAULT_IMAGE_MODEL,
      imageResolution: DEFAULT_IMAGE_RESOLUTION,
      imageRatio: DEFAULT_IMAGE_RATIO,
      imageCount: DEFAULT_IMAGE_COUNT,
      x,
      y,
      width: 320,
      height: 300,
    };
  }

  if (type === 'video') {
    return {
      id,
      type,
      title: '视频节点',
      content: DEFAULT_VIDEO_URL,
      x,
      y,
      width: 340,
      height: 260,
    };
  }

  return {
    id,
    type: 'note',
    title: '文本节点',
    prompt: '',
    content: '选择文本节点后，在下方输入文字并运行。',
    x,
    y,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
  };
}

export function createDocument(name, withStarterNodes = true) {
  const now = Date.now();
  const nodes = withStarterNodes
    ? [
        {
          id: uid('node'),
          type: 'note',
          title: '欢迎使用',
          prompt: '',
          content: '这是一个轻量画布。点击文本节点，在下方输入文字后运行或翻译。',
          x: 120,
          y: 100,
          width: DEFAULT_NODE_WIDTH,
          height: DEFAULT_NODE_HEIGHT,
        },
        {
          id: uid('node'),
          type: 'image',
          title: '示例图片',
          content: PLACEHOLDER_IMAGE,
          x: 520,
          y: 210,
          width: 320,
          height: 300,
        },
      ]
    : [];

  const connections = withStarterNodes
    ? [
        {
          id: uid('link'),
          fromNodeId: nodes[0].id,
          toNodeId: nodes[1].id,
        },
      ]
    : [];

  return {
    id: uid('canvas'),
    name,
    nodes,
    connections,
    createdAt: now,
    updatedAt: now,
  };
}

export function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function snapScale(value) {
  return Math.round(value * 10) / 10;
}

export function getConnectionPath(source, target) {
  const x1 = source.x + source.width;
  const y1 = source.y + source.height / 2;
  const x2 = target.x;
  const y2 = target.y + target.height / 2;
  const bend = Math.max(80, Math.abs(x2 - x1) * 0.35);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

export function getDraftConnectionPath(source, pointerPos) {
  const x1 = source.x + source.width;
  const y1 = source.y + source.height / 2;
  const x2 = pointerPos.x;
  const y2 = pointerPos.y;
  const bend = Math.max(80, Math.abs(x2 - x1) * 0.35);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

export function isImageContent(content) {
  return typeof content === 'string' && (content.startsWith('data:image') || /^https?:\/\//.test(content));
}

export function isVideoContent(content) {
  return typeof content === 'string' && (content.startsWith('data:video') || /^https?:\/\//.test(content));
}
