/** 画布有改动后，延迟多久再上传到云端（防抖，减少频繁保存） */
export const CLOUD_SYNC_DEBOUNCE_MS = 3000;
export const STORAGE_KEY = 'jimicanvas.documents.v1';
export const ACTIVE_CANVAS_ID_KEY = 'jimicanvas.active_canvas_id';
export const JIMIAIGO_TOKEN_STORAGE_KEY = 'jimicanvas.jimiaigo.token';
export const ADMIN_TOKEN_COOKIE_KEY = 'Admin-Token';
/** 从 jimiaiapp 跳转时暂存待打开的画布 ID */
export const PENDING_CANVAS_ID_KEY = 'jimicanvas.pending_canvas_id';
/** 从 jimiaiapp 跳转时标记需要新建画布 */
export const PENDING_NEW_CANVAS_KEY = 'jimicanvas.pending_new_canvas';
/** 新建画布时使用的预设工作流模版 ID */
export const PENDING_WORKFLOW_TEMPLATE_KEY = 'jimicanvas.pending_workflow_template';
export const DEFAULT_CHAT_API_URL = 'http://localhost:27355';
export const DEFAULT_SITE_TITLE = 'JimiCanvas';
export const DEFAULT_SITE_SLOGAN = '轻量画布工作台';
export const DEFAULT_KEFU_QR_URL = '/wechat-qrcode.png';
export const DEFAULT_TEXT_MODEL = 'gpt-5.4-mini';
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
export const DEFAULT_IMAGE_RESOLUTION = '1k';
export const DEFAULT_IMAGE_RATIO = '1:1';
export const DEFAULT_IMAGE_COUNT = 1;
export const DEFAULT_IMAGE_QUALITY = 'auto';
export const DEFAULT_NODE_WIDTH = 260;
export const DEFAULT_NODE_HEIGHT = 180;
export const MIN_NOTE_WIDTH = 180;
export const MIN_NOTE_HEIGHT = 100;
export const MAX_NOTE_WIDTH = 800;
export const MAX_NOTE_HEIGHT = 640;
export const MIN_CANVAS_SCALE = 0.1;
export const MAX_CANVAS_SCALE = 1.4;
export const CANVAS_SCALE_STEP = 0.1;
export const CANVAS_WHEEL_PAN_FACTOR = 1;
export const CANVAS_GRID_CELL_SIZE = 28;
export const DEFAULT_CANVAS_BACKGROUND = 'grid';
export const CANVAS_BACKGROUND_OPTIONS = [
  { value: 'grid', label: '网格', hint: '网状参考线' },
  { value: 'dots', label: '点状', hint: '圆点参考' },
  { value: 'line', label: '横线', hint: '水平参考线' },
  { value: 'none', label: '纯色', hint: '无背景纹理' },
];
export const DEFAULT_VIDEO_URL = '/demo/default-tiktok-ecommerce-9x16.mp4';
export const DEFAULT_IMAGE_URL = '/demo/default-handsome-american-man.jpg';
export const DEFAULT_DEMO_IMAGE_RATIO = '3:2';
export const DEFAULT_VIDEO_FAMILY = 'sora';
export const DEFAULT_VIDEO_MODEL = 'sora2-gz-sp';
export const DEFAULT_VIDEO_ROUTE = 'route3';
export const DEFAULT_VIDEO_DURATION = '8';
export const DEFAULT_SORA_VIDEO_DURATION = '12';
export const DEFAULT_VIDEO_ORIENTATION = 'portrait';
export const DEFAULT_VIDEO_RATIO = '9:16';
export const DEFAULT_VIDEO_SIZE = '720x1280';
export const DEFAULT_VIDEO_RESOLUTION = '720p';
export const DEFAULT_VIDEO_QUALITY = '720p';
export const DEFAULT_VIDEO_COUNT = 1;
export const DEFAULT_VEO_GENERATION_TYPE = 'frame';
export const VEO_REFERENCE_IMAGE_MAX = 3;
export const SEEDANCE_REF_IMAGE_MAX = 9;
export const SEEDANCE_REF_VIDEO_MAX = 3;
export const SEEDANCE_REF_AUDIO_MAX = 3;
export const VIDEO_GENERIC_REFERENCE_MAX = 5;

export const IMAGE_REFERENCE_LIMITS = {
  nanobanana2: 5,
  nanobananapro: 5,
  'gpt-image-2': 16,
};

export function getImageReferenceMax(model) {
  return IMAGE_REFERENCE_LIMITS[model] || IMAGE_REFERENCE_LIMITS[DEFAULT_IMAGE_MODEL] || 5;
}

export const DEFAULT_AUDIO_MODEL = 'gpt-4o-mini-tts';
export const DEFAULT_AUDIO_VOICE = 'alloy';
export const DEFAULT_AUDIO_SPEED = 1;
export const DEFAULT_AUDIO_NODE_WIDTH = 360;
export const DEFAULT_AUDIO_NODE_HEIGHT = 168;
export const MIN_AUDIO_NODE_HEIGHT = 168;
export const MIN_AUDIO_NODE_HEIGHT_WITH_CONTENT = 192;

export const AUDIO_VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy', hint: '中性、平衡' },
  { value: 'echo', label: 'Echo', hint: '男声、沉稳' },
  { value: 'fable', label: 'Fable', hint: '英式、叙述' },
  { value: 'onyx', label: 'Onyx', hint: '男声、深沉' },
  { value: 'nova', label: 'Nova', hint: '女声、活力' },
  { value: 'shimmer', label: 'Shimmer', hint: '女声、温柔' },
];

export const AUDIO_SPEED_OPTIONS = [
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
];

export const VEO_GENERATION_TYPE_OPTIONS = [
  { value: 'frame', label: '首尾帧' },
  { value: 'reference', label: '参考图' },
];

export const VIDEO_FAMILY_OPTIONS = [
  { value: 'sora', label: 'Sora' },
  { value: 'veo', label: 'VEO' },
  { value: 'omni', label: 'Omni' },
  { value: 'seedance', label: 'Seedance' },
  { value: 'grok', label: 'Grok' },
];

export const VIDEO_COUNT_OPTIONS = [
  { value: 1, label: '1 次' },
  { value: 2, label: '2 次' },
  { value: 3, label: '3 次' },
];

export const VIDEO_FAMILY_CONFIG = {
  sora: {
    provider: 'sora',
    route: 'route3',
    defaultDuration: '12',
    defaultOrientation: 'portrait',
    models: [
      { value: 'sora2-gz-sp', label: 'Sora2 特价版' },
      { value: 'sora2-gz-stable', label: 'Sora2 稳定版' },
    ],
    ratios: [
      { value: 'landscape', label: '横屏 16:9' },
      { value: 'portrait', label: '竖屏 9:16' },
    ],
    durations: [
      { value: '4', label: '4 秒' },
      { value: '8', label: '8 秒' },
      { value: '12', label: '12 秒' },
    ],
    maxCount: 3,
    resolutionKey: 'size',
    ratioKey: 'orientation',
  },
  veo: {
    provider: 'veo',
    defaultDuration: '8',
    models: [{ value: 'sc-veo3.1-fast', label: 'VEO 3.1 Fast' }],
    resolutions: [
      { value: '720p', label: '720p' },
      { value: '1080p', label: '1080p' },
      { value: '4k', label: '4K' },
    ],
    ratios: [
      { value: '16:9', label: '16:9' },
      { value: '9:16', label: '9:16' },
      { value: '1:1', label: '1:1' },
    ],
    durations: [{ value: '8', label: '8 秒' }],
    maxCount: 3,
    resolutionKey: 'resolution',
    ratioKey: 'ratio',
  },
  omni: {
    provider: 'omni',
    models: [{ value: 'Gemini-Omini', label: 'Gemini Omni' }],
    resolutions: [
      { value: '720p', label: '720p' },
      { value: '1080p', label: '1080p' },
      { value: '4k', label: '4K' },
    ],
    ratios: [
      { value: '16:9', label: '16:9' },
      { value: '9:16', label: '9:16' },
      { value: '1:1', label: '1:1' },
    ],
    durations: [
      { value: '4', label: '4 秒' },
      { value: '6', label: '6 秒' },
      { value: '8', label: '8 秒' },
      { value: '10', label: '10 秒' },
    ],
    maxCount: 3,
    resolutionKey: 'resolution',
    ratioKey: 'ratio',
  },
  seedance: {
    provider: 'seedance-manxue',
    models: [{ value: 'seedance-2.0-manxue', label: 'Seedance 2.0 满血版' }],
    resolutions: [
      { value: '480p', label: '480p' },
      { value: '720p', label: '720p' },
    ],
    manxueResolutions: [
      { value: '720p', label: '720P' },
      { value: '1080p', label: '1080P' },
      { value: '2k', label: '2K' },
      { value: '4k', label: '4K' },
    ],
    manxueDurations: [
      { value: '4', label: '4 秒' },
      { value: '5', label: '5 秒' },
      { value: '6', label: '6 秒' },
      { value: '8', label: '8 秒' },
      { value: '10', label: '10 秒' },
      { value: '12', label: '12 秒' },
      { value: '15', label: '15 秒' },
    ],
    standardDurations: [
      { value: '5', label: '5 秒' },
      { value: '10', label: '10 秒' },
      { value: '15', label: '15 秒' },
    ],
    ratios: [
      { value: '16:9', label: '16:9' },
      { value: '9:16', label: '9:16' },
      { value: '1:1', label: '1:1' },
      { value: '4:3', label: '4:3' },
      { value: '3:4', label: '3:4' },
    ],
    durations: [
      { value: '5', label: '5 秒' },
      { value: '10', label: '10 秒' },
      { value: '15', label: '15 秒' },
    ],
    maxCount: 3,
    resolutionKey: 'resolution',
    ratioKey: 'ratio',
  },
  grok: {
    provider: 'grok',
    models: [{ value: 'grok_video3', label: 'Grok Video 3' }],
    resolutions: [
      { value: '480p', label: '480p' },
      { value: '720p', label: '720p' },
    ],
    ratios: [
      { value: '16:9', label: '16:9' },
      { value: '9:16', label: '9:16' },
      { value: '1:1', label: '1:1' },
      { value: '3:2', label: '3:2' },
      { value: '2:3', label: '2:3' },
    ],
    durations: [
      { value: '6', label: '6 秒' },
      { value: '10', label: '10 秒' },
      { value: '15', label: '15 秒' },
      { value: '20', label: '20 秒' },
      { value: '30', label: '30 秒' },
    ],
    maxCount: 3,
    resolutionKey: 'quality',
    ratioKey: 'ratio',
  },
};

export const SEEDANCE_MANXUE_MODEL = 'seedance-2.0-manxue';

export function isSeedanceManxueModel(model = '') {
  const value = String(model).toLowerCase();
  return (
    value === SEEDANCE_MANXUE_MODEL ||
    value.startsWith('sd2_mx_') ||
    value.startsWith('sd2_manxue_') ||
    value === 'doubao-seedance-2.0-fast'
  );
}

export function isSeedanceStandardModel(model = '') {
  return String(model) === 'doubao-seedance-2.0';
}

export function resolutionFromManxueModel(model = '') {
  const value = String(model).toLowerCase();
  if (value.includes('720p')) return '720p';
  if (value.includes('1080p')) return '1080p';
  if (value.includes('2k')) return '2k';
  if (value.includes('4k')) return '4k';
  return '720p';
}

export function getDefaultVideoOrientation(family = DEFAULT_VIDEO_FAMILY) {
  return getVideoFamilyConfig(family).defaultOrientation || DEFAULT_VIDEO_ORIENTATION;
}

export function defaultSoraSize(orientation) {
  const resolved = orientation ?? getDefaultVideoOrientation('sora');
  return resolved === 'portrait' ? '720x1280' : '1280x720';
}

export function buildManxueApiModel(resolution = '720p') {
  const map = {
    '720p': 'sd2_mx_720p',
    '1080p': 'sd2_mx_1080p',
    '2k': 'sd2_mx_2k',
    '4k': 'sd2_mx_4k',
  };
  return map[String(resolution).toLowerCase()] || 'sd2_mx_720p';
}

export function normalizeSeedanceUiModel(model = '') {
  if (isSeedanceManxueModel(model) && model !== SEEDANCE_MANXUE_MODEL) {
    return SEEDANCE_MANXUE_MODEL;
  }
  if (model === 'doubao-seedance-2.0-fast') {
    return SEEDANCE_MANXUE_MODEL;
  }
  return model;
}

export function inferVideoFamily(node = {}) {
  if (node.videoFamily && VIDEO_FAMILY_CONFIG[node.videoFamily]) {
    return node.videoFamily;
  }

  const model = String(node.videoModel || '').toLowerCase();
  if (model.includes('grok')) return 'grok';
  if (isSeedanceManxueModel(model) || model.includes('seedance') || model.includes('doubao')) return 'seedance';
  if (model.includes('veo') || model.startsWith('sc-veo')) return 'veo';
  if (model.includes('omni') || model.includes('gemini')) return 'omni';
  return 'sora';
}

export function getVideoFamilyConfig(family = DEFAULT_VIDEO_FAMILY) {
  return VIDEO_FAMILY_CONFIG[family] || VIDEO_FAMILY_CONFIG[DEFAULT_VIDEO_FAMILY];
}

export function getVideoModelOptions(family) {
  return getVideoFamilyConfig(family).models;
}

export function getVideoResolutionOptions(family, model = '') {
  const config = getVideoFamilyConfig(family);
  if (family === 'sora') {
    return [];
  }
  if (family === 'seedance' && isSeedanceManxueModel(model)) {
    return config.manxueResolutions || [];
  }
  if (family === 'seedance' && isSeedanceStandardModel(model)) {
    return config.resolutions;
  }
  return config.resolutions;
}

export function getVideoRatioOptions(family) {
  return getVideoFamilyConfig(family).ratios;
}

export function getVideoDurationOptions(family, model = '') {
  const config = getVideoFamilyConfig(family);
  if (family === 'seedance' && isSeedanceManxueModel(model)) {
    return config.manxueDurations || config.durations;
  }
  if (family === 'seedance' && isSeedanceStandardModel(model)) {
    return config.standardDurations || config.durations;
  }
  return config.durations;
}

export function getVideoCountOptions(family) {
  const maxCount = getVideoFamilyConfig(family).maxCount;
  return VIDEO_COUNT_OPTIONS.filter((option) => option.value <= maxCount);
}

export function getDefaultVideoDuration(family = DEFAULT_VIDEO_FAMILY) {
  return getVideoFamilyConfig(family).defaultDuration || DEFAULT_VIDEO_DURATION;
}

export function normalizeVeoGenerationType(value) {
  return VEO_GENERATION_TYPE_OPTIONS.some((option) => option.value === value)
    ? value
    : DEFAULT_VEO_GENERATION_TYPE;
}

export function normalizeVideoModelSettings({
  family = DEFAULT_VIDEO_FAMILY,
  model = DEFAULT_VIDEO_MODEL,
  size = DEFAULT_VIDEO_SIZE,
  resolution = DEFAULT_VIDEO_RESOLUTION,
  orientation,
  ratio = DEFAULT_VIDEO_RATIO,
  quality = DEFAULT_VIDEO_QUALITY,
  duration,
  generationType,
  count = DEFAULT_VIDEO_COUNT,
  route = DEFAULT_VIDEO_ROUTE,
} = {}) {
  const config = getVideoFamilyConfig(family);
  const effectiveDuration = duration ?? getDefaultVideoDuration(family);
  const normalizedGenerationType = family === 'veo' ? normalizeVeoGenerationType(generationType) : undefined;
  const effectiveOrientation = orientation ?? getDefaultVideoOrientation(family);
  const modelOptions = config.models || [];
  const ratioOptions = config.ratios || [];

  const isManxueSeedance = family === 'seedance' && isSeedanceManxueModel(model);
  const manxueResolutionOptions = config.manxueResolutions || [];

  let normalizedModel = modelOptions.some((option) => option.value === normalizeSeedanceUiModel(model))
    ? normalizeSeedanceUiModel(model)
    : isManxueSeedance
      ? SEEDANCE_MANXUE_MODEL
      : modelOptions[0]?.value;

  if (family === 'seedance' && isSeedanceManxueModel(model) && model !== SEEDANCE_MANXUE_MODEL) {
    normalizedModel = SEEDANCE_MANXUE_MODEL;
  }

  const durationOptions =
    family === 'seedance' && isSeedanceManxueModel(normalizedModel)
      ? config.manxueDurations || config.durations
      : family === 'seedance' && isSeedanceStandardModel(normalizedModel)
        ? config.standardDurations || config.durations
        : config.durations;

  const normalizedRatio = ratioOptions.some((option) => option.value === (family === 'sora' ? effectiveOrientation : ratio))
    ? family === 'sora'
      ? effectiveOrientation
      : ratio
    : family === 'sora'
      ? getDefaultVideoOrientation(family)
      : ratioOptions[0]?.value;

  let normalizedResolution = resolution;
  if (family === 'sora') {
    normalizedResolution = defaultSoraSize(normalizedRatio);
  } else if (family === 'seedance' && isSeedanceManxueModel(normalizedModel)) {
    const manxueResolutionFromModel = isManxueSeedance && model !== SEEDANCE_MANXUE_MODEL
      ? resolutionFromManxueModel(model)
      : resolution;
    normalizedResolution = manxueResolutionOptions.some(
      (option) => option.value === manxueResolutionFromModel
    )
      ? manxueResolutionFromModel
      : manxueResolutionOptions[0]?.value || '720p';
  } else if (family === 'grok') {
    const resolutionOptions = config.resolutions || [];
    normalizedResolution = resolutionOptions.some((option) => option.value === quality)
      ? quality
      : resolutionOptions[0]?.value;
  } else {
    const resolutionOptions = getVideoResolutionOptions(family, normalizedModel);
    normalizedResolution = resolutionOptions.some((option) => option.value === resolution)
      ? resolution
      : resolutionOptions[0]?.value;
  }

  const normalizedDuration = durationOptions.some((option) => option.value === String(effectiveDuration))
    ? String(effectiveDuration)
    : getDefaultVideoDuration(family);

  const isManxueProvider = family === 'seedance' && isSeedanceManxueModel(normalizedModel);
  const provider = isManxueProvider ? 'seedance-manxue' : config.provider;
  const apiModel = isManxueProvider ? buildManxueApiModel(normalizedResolution) : normalizedModel;

  return {
    family,
    model: normalizedModel,
    apiModel,
    route: family === 'sora' ? route || config.route : undefined,
    provider,
    size: family === 'sora' ? normalizedResolution : undefined,
    resolution: family === 'sora' ? undefined : normalizedResolution,
    quality: family === 'grok' ? normalizedResolution : undefined,
    orientation: family === 'sora' ? normalizedRatio : undefined,
    ratio: family === 'sora' ? undefined : normalizedRatio,
    duration: normalizedDuration,
    generationType: normalizedGenerationType,
    count: Math.min(config.maxCount, Math.max(1, Number(count) || DEFAULT_VIDEO_COUNT)),
  };
}

export const IMAGE_MODEL_OPTIONS = [
  { value: 'gpt-image-2', label: 'gpt image2' },
  { value: 'nanobanana2', label: 'nano banana2' },
  { value: 'nanobananapro', label: 'nano banana pro' },
];

export const IMAGE_RESOLUTION_OPTIONS = [
  { value: '1k', label: '1K' },
  { value: '2k', label: '2K' },
  { value: '4k', label: '4K' },
];

export const IMAGE_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: '4:3', label: '4:3' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
];

export const GPT_IMAGE_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '5:4', label: '5:4' },
  { value: '4:5', label: '4:5' },
  { value: '2:1', label: '2:1' },
  { value: '1:2', label: '1:2' },
  { value: '21:9', label: '21:9' },
  { value: '9:21', label: '9:21' },
];

export const IMAGE_COUNT_OPTIONS = [
  { value: 1, label: '1 次' },
  { value: 2, label: '2 次' },
  { value: 3, label: '3 次' },
  { value: 4, label: '4 次' },
  { value: 5, label: '5 次' },
];

export const IMAGE_QUALITY_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

export const IMAGE_MODEL_LIMITS = {
  nanobanana2: {
    resolutions: ['1k', '2k', '4k'],
    ratios: IMAGE_RATIO_OPTIONS.map((option) => option.value),
    maxCount: 5,
  },
  nanobananapro: {
    resolutions: ['1k', '2k', '4k'],
    ratios: IMAGE_RATIO_OPTIONS.map((option) => option.value),
    maxCount: 5,
  },
  'gpt-image-2': {
    resolutions: ['1k', '2k', '4k'],
    ratios: GPT_IMAGE_RATIO_OPTIONS.map((option) => option.value),
    qualities: IMAGE_QUALITY_OPTIONS.map((option) => option.value),
    maxCount: 5,
  },
};

export function getImageModelLimits(model) {
  return IMAGE_MODEL_LIMITS[model] || IMAGE_MODEL_LIMITS[DEFAULT_IMAGE_MODEL];
}

export function getImageResolutionOptions(model) {
  const allowed = new Set(getImageModelLimits(model).resolutions);
  return IMAGE_RESOLUTION_OPTIONS.filter((option) => allowed.has(option.value));
}

export function getImageRatioOptions(model) {
  const allowed = new Set(getImageModelLimits(model).ratios);
  return (model === 'gpt-image-2' ? GPT_IMAGE_RATIO_OPTIONS : IMAGE_RATIO_OPTIONS).filter((option) =>
    allowed.has(option.value)
  );
}

export function getImageCountOptions(model) {
  const maxCount = getImageModelLimits(model).maxCount;
  return IMAGE_COUNT_OPTIONS.filter((option) => option.value <= maxCount);
}

export function getImageQualityOptions(model) {
  const allowed = getImageModelLimits(model).qualities;
  if (!allowed) return [];
  const allowedSet = new Set(allowed);
  return IMAGE_QUALITY_OPTIONS.filter((option) => allowedSet.has(option.value));
}

export function normalizeImageModelSettings({
  model = DEFAULT_IMAGE_MODEL,
  resolution = DEFAULT_IMAGE_RESOLUTION,
  ratio = DEFAULT_IMAGE_RATIO,
  count = DEFAULT_IMAGE_COUNT,
  quality = DEFAULT_IMAGE_QUALITY,
} = {}) {
  const resolutionOptions = getImageResolutionOptions(model);
  const ratioOptions = getImageRatioOptions(model);
  const qualityOptions = getImageQualityOptions(model);
  const maxCount = getImageModelLimits(model).maxCount;

  return {
    model,
    resolution: resolutionOptions.some((option) => option.value === resolution)
      ? resolution
      : resolutionOptions[0]?.value || DEFAULT_IMAGE_RESOLUTION,
    ratio: ratioOptions.some((option) => option.value === ratio)
      ? ratio
      : ratioOptions[0]?.value || DEFAULT_IMAGE_RATIO,
    count: Math.min(maxCount, Math.max(1, Number(count) || DEFAULT_IMAGE_COUNT)),
    quality:
      qualityOptions.length === 0
        ? undefined
        : qualityOptions.some((option) => option.value === quality)
          ? quality
          : qualityOptions[0]?.value || DEFAULT_IMAGE_QUALITY,
  };
}

export const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" rx="24" fill="url(#g)"/>
    <rect x="44" y="44" width="552" height="272" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)"/>
    <circle cx="204" cy="156" r="32" fill="#38bdf8"/>
    <path d="M118 268L244 160L332 236L418 188L538 268" fill="none" stroke="#e0f2fe" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="320" y="312" text-anchor="middle" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="24">Canvas image node</text>
  </svg>
`)}`;
