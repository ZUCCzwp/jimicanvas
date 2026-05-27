import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  MAX_NOTE_HEIGHT,
  MAX_NOTE_WIDTH,
  MIN_NOTE_HEIGHT,
  MIN_NOTE_WIDTH,
  DEFAULT_IMAGE_COUNT,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_RATIO,
  DEFAULT_IMAGE_RESOLUTION,
  DEFAULT_VIDEO_COUNT,
  DEFAULT_VEO_GENERATION_TYPE,
  getDefaultVideoDuration,
  getDefaultVideoOrientation,
  defaultSoraSize,
  DEFAULT_VIDEO_FAMILY,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_VIDEO_QUALITY,
  DEFAULT_VIDEO_RATIO,
  DEFAULT_VIDEO_RESOLUTION,
  DEFAULT_VIDEO_ROUTE,
  DEFAULT_VIDEO_URL,
  PLACEHOLDER_IMAGE,
} from './constants';
import { computeImageOutputSize, parseRatioValue } from './imageNodeLayout';
import { buildVideoNodeLayoutPatch } from './videoNodeLayout';

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createNode(type, x, y) {
  const id = uid('node');
  if (type === 'image') {
    const ratio = parseRatioValue(DEFAULT_IMAGE_RATIO);
    const outputSize = computeImageOutputSize({
      aspectWidth: ratio.width,
      aspectHeight: ratio.height,
      imageCount: DEFAULT_IMAGE_COUNT,
    });

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
      outputAspectCss: outputSize.cssAspectRatio,
      x,
      y,
      width: outputSize.width,
      height: outputSize.height,
    };
  }

  if (type === 'video') {
    const videoDefaults = {
      videoFamily: DEFAULT_VIDEO_FAMILY,
      videoOrientation: getDefaultVideoOrientation(DEFAULT_VIDEO_FAMILY),
      videoRatio: DEFAULT_VIDEO_RATIO,
      videoSize: defaultSoraSize(getDefaultVideoOrientation(DEFAULT_VIDEO_FAMILY)),
    };
    const videoLayout = buildVideoNodeLayoutPatch(videoDefaults);

    return {
      id,
      type,
      title: '视频节点',
      prompt: '',
      content: DEFAULT_VIDEO_URL,
      videos: [],
      referenceImages: [],
      videoFamily: videoDefaults.videoFamily,
      videoModel: DEFAULT_VIDEO_MODEL,
      videoRoute: DEFAULT_VIDEO_ROUTE,
      videoDuration: getDefaultVideoDuration(DEFAULT_VIDEO_FAMILY),
      videoOrientation: videoDefaults.videoOrientation,
      videoRatio: videoDefaults.videoRatio,
      videoSize: videoDefaults.videoSize,
      videoResolution: DEFAULT_VIDEO_RESOLUTION,
      videoQuality: DEFAULT_VIDEO_QUALITY,
      videoCount: DEFAULT_VIDEO_COUNT,
      videoGenerationType: DEFAULT_VEO_GENERATION_TYPE,
      videoFirstFrame: null,
      videoLastFrame: null,
      videoTaskSource: null,
      outputAspectCss: videoLayout.outputAspectCss,
      status: 'idle',
      x,
      y,
      width: videoLayout.width,
      height: videoLayout.height,
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

const VIDEO_CONTENT_PATTERN = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;

export function isVideoContent(content) {
  if (typeof content !== 'string') return false;
  const value = content.trim();
  if (!value) return false;
  if (value.startsWith('data:video') || value.startsWith('blob:')) return true;
  if (/^https?:\/\//.test(value)) return true;
  return VIDEO_CONTENT_PATTERN.test(value);
}

export function clampNoteSize(width, height) {
  return {
    width: Math.min(MAX_NOTE_WIDTH, Math.max(MIN_NOTE_WIDTH, Math.round(width))),
    height: Math.min(MAX_NOTE_HEIGHT, Math.max(MIN_NOTE_HEIGHT, Math.round(height))),
  };
}

export function duplicateNode(source, offsetX = 28, offsetY = 28) {
  const cloned = JSON.parse(JSON.stringify(source));
  cloned.id = uid('node');
  cloned.x = (Number(source.x) || 0) + offsetX;
  cloned.y = (Number(source.y) || 0) + offsetY;

  if (cloned.status === 'running') {
    cloned.status = 'idle';
  }

  delete cloned.imageTaskId;
  delete cloned.videoTaskId;
  delete cloned.pendingTasks;
  delete cloned.generationJob;
  delete cloned.generationBatch;

  return cloned;
}

export function getNodeBounds(node, fallbackWidth = DEFAULT_NODE_WIDTH, fallbackHeight = DEFAULT_NODE_HEIGHT) {
  return {
    x: Number(node?.x) || 0,
    y: Number(node?.y) || 0,
    width: Number(node?.width) || fallbackWidth,
    height: Number(node?.height) || fallbackHeight,
  };
}

export function normalizeSelectionRect(startX, startY, endX, endY) {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  return {
    x,
    y,
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

export function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function getNodesInSelectionRect(nodes, rect, fallbackWidth = DEFAULT_NODE_WIDTH, fallbackHeight = DEFAULT_NODE_HEIGHT) {
  if (rect.width <= 0 && rect.height <= 0) return [];

  return nodes.filter((node) => rectsIntersect(getNodeBounds(node, fallbackWidth, fallbackHeight), rect));
}
