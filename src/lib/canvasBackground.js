import { CANVAS_BACKGROUND_OPTIONS, DEFAULT_CANVAS_BACKGROUND } from './constants';

const VALID_BACKGROUNDS = new Set(CANVAS_BACKGROUND_OPTIONS.map((option) => option.value));

export function normalizeCanvasBackground(value) {
  const next = String(value || '').trim();
  return VALID_BACKGROUNDS.has(next) ? next : DEFAULT_CANVAS_BACKGROUND;
}

export function getCanvasBackgroundOption(value) {
  const normalized = normalizeCanvasBackground(value);
  return CANVAS_BACKGROUND_OPTIONS.find((option) => option.value === normalized)
    || CANVAS_BACKGROUND_OPTIONS[0];
}
