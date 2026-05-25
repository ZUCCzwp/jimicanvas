export const STORAGE_KEY = 'jimicanvas.documents.v1';
export const JIMIAIGO_TOKEN_STORAGE_KEY = 'jimicanvas.jimiaigo.token';
export const DEFAULT_CHAT_API_URL = 'http://localhost:27355';
export const DEFAULT_TEXT_MODEL = 'gpt-5.4-mini';
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
export const DEFAULT_IMAGE_RESOLUTION = '1k';
export const DEFAULT_IMAGE_RATIO = '1:1';
export const DEFAULT_IMAGE_COUNT = 1;
export const DEFAULT_NODE_WIDTH = 260;
export const DEFAULT_NODE_HEIGHT = 180;
export const MIN_CANVAS_SCALE = 0.6;
export const MAX_CANVAS_SCALE = 1.4;
export const CANVAS_SCALE_STEP = 0.1;
export const DEFAULT_VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

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
    maxCount: 1,
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

export function normalizeImageModelSettings({
  model = DEFAULT_IMAGE_MODEL,
  resolution = DEFAULT_IMAGE_RESOLUTION,
  ratio = DEFAULT_IMAGE_RATIO,
  count = DEFAULT_IMAGE_COUNT,
} = {}) {
  const resolutionOptions = getImageResolutionOptions(model);
  const ratioOptions = getImageRatioOptions(model);
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
