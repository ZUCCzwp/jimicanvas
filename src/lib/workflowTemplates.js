import { createNode, uid } from './canvas';
import { DEFAULT_CANVAS_BACKGROUND } from './constants';

const NODE_GAP_X = 340;

export const WORKFLOW_TEMPLATES = [
  {
    id: 'text-to-image',
    name: '文生图',
    description: '输入文字描述，AI 生成图片',
    icon: 'image',
  },
  {
    id: 'image-to-video',
    name: '图生视频',
    description: '上传参考图，生成动态视频',
    icon: 'video',
  },
  {
    id: 'image-to-prompt',
    name: '图片反推提示词',
    description: '从图片反推可用于生图的提示词',
    icon: 'scan',
  },
  {
    id: 'video-to-prompt',
    name: '视频反推提示词',
    description: '从视频反推可用于生视频的提示词',
    icon: 'video-scan',
  },
  {
    id: 'image-to-image',
    name: '图生图',
    description: '以参考图为底，生成风格化新图',
    icon: 'layers',
  },
];

function createLink(fromNodeId, toNodeId) {
  return { id: uid('link'), fromNodeId, toNodeId };
}

function buildDocument(name, nodes, connections) {
  const now = Date.now();
  return {
    id: uid('canvas'),
    name,
    nodes,
    connections,
    background: DEFAULT_CANVAS_BACKGROUND,
    createdAt: now,
    updatedAt: now,
  };
}

function buildTextToImageNodes(originX = 80, originY = 160) {
  const note = createNode('note', originX, originY);
  note.title = '提示词';
  note.content = '在此输入画面描述，或在下方输入框填写提示词后运行右侧图片节点。';
  note.prompt = '';

  const image = createNode('image', originX + NODE_GAP_X, originY - 20);
  image.title = '文生图';

  return {
    nodes: [note, image],
    connections: [createLink(note.id, image.id)],
  };
}

function buildImageToVideoNodes(originX = 80, originY = 140) {
  const image = createNode('image', originX, originY);
  image.title = '参考图';

  const video = createNode('video', originX + NODE_GAP_X, originY - 20);
  video.title = '图生视频';

  return {
    nodes: [image, video],
    connections: [createLink(image.id, video.id)],
  };
}

function buildImageToPromptNodes(originX = 80, originY = 160) {
  const image = createNode('image', originX, originY);
  image.title = '源图片';

  const note = createNode('note', originX + NODE_GAP_X, originY);
  note.title = '反推提示词';
  note.workflowMode = 'image-to-prompt';
  note.content = '连接左侧图片后，点击运行反推提示词。';
  note.prompt = '';

  return {
    nodes: [image, note],
    connections: [createLink(image.id, note.id)],
  };
}

function buildVideoToPromptNodes(originX = 80, originY = 140) {
  const video = createNode('video', originX, originY - 20);
  video.title = '源视频';

  const note = createNode('note', originX + NODE_GAP_X, originY);
  note.title = '反推提示词';
  note.workflowMode = 'video-to-prompt';
  note.content = '连接左侧视频后，点击「反推」获取结构化提示词。';
  note.prompt = '';

  return {
    nodes: [video, note],
    connections: [createLink(video.id, note.id)],
  };
}

function buildImageToImageNodes(originX = 80, originY = 160) {
  const source = createNode('image', originX, originY);
  source.title = '参考图';

  const target = createNode('image', originX + NODE_GAP_X, originY);
  target.title = '图生图';

  return {
    nodes: [source, target],
    connections: [createLink(source.id, target.id)],
  };
}

const TEMPLATE_BUILDERS = {
  'text-to-image': buildTextToImageNodes,
  'image-to-video': buildImageToVideoNodes,
  'image-to-prompt': buildImageToPromptNodes,
  'video-to-prompt': buildVideoToPromptNodes,
  'image-to-image': buildImageToImageNodes,
};

export function getWorkflowTemplate(templateId) {
  return WORKFLOW_TEMPLATES.find((item) => item.id === templateId) || null;
}

export function getWorkflowTemplateDefaultName(templateId, index = 1) {
  const template = getWorkflowTemplate(templateId);
  if (!template) return `画布 ${index}`;
  return `${template.name} · ${index}`;
}

export function buildWorkflowTemplateFragment(templateId, originX = 80, originY = 160) {
  const builder = TEMPLATE_BUILDERS[templateId];
  if (!builder) {
    return { nodes: [], connections: [] };
  }
  return builder(originX, originY);
}

export function createWorkflowTemplateDocument(templateId, name) {
  const template = getWorkflowTemplate(templateId);
  const documentName = name || template?.name || '工作流画布';
  const { nodes, connections } = buildWorkflowTemplateFragment();
  return buildDocument(documentName, nodes, connections);
}
