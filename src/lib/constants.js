export const STORAGE_KEY = 'jimicanvas.documents.v1';
export const JIMIAIGO_TOKEN_STORAGE_KEY = 'jimicanvas.jimiaigo.token';
export const DEFAULT_CHAT_API_URL = 'http://localhost:27355';
export const DEFAULT_TEXT_MODEL = 'gpt-5.4-mini';
export const DEFAULT_NODE_WIDTH = 260;
export const DEFAULT_NODE_HEIGHT = 180;
export const MIN_CANVAS_SCALE = 0.6;
export const MAX_CANVAS_SCALE = 1.4;
export const CANVAS_SCALE_STEP = 0.1;
export const DEFAULT_VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

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
