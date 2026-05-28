export const NOTE_CONTENT_FONT_SIZES = [12, 13, 14, 16, 18, 20, 24];

export const NOTE_THEME_BG = 'var(--node-inner-bg)';
export const NOTE_THEME_TEXT = 'var(--text-node)';

const LEGACY_DEFAULT_BG = 'rgba(15, 23, 42, 0.5)';
const LEGACY_DEFAULT_TEXT = '#e2e8f0';

export const DEFAULT_NOTE_CONTENT_STYLE = {
  fontSize: 13,
  fontWeight: 'normal',
  fontStyle: 'normal',
  backgroundColor: NOTE_THEME_BG,
  color: NOTE_THEME_TEXT,
};

export const NOTE_BACKGROUND_PRESETS = [
  { label: '默认', value: NOTE_THEME_BG },
  { label: '墨蓝', value: 'rgba(30, 58, 138, 0.45)' },
  { label: '墨绿', value: 'rgba(6, 78, 59, 0.45)' },
  { label: '暖棕', value: 'rgba(120, 53, 15, 0.42)' },
  { label: '浅灰', value: 'rgba(148, 163, 184, 0.28)' },
  { label: '米白', value: 'var(--surface-2)' },
];

export const NOTE_TEXT_COLOR_PRESETS = [
  { label: '默认', value: NOTE_THEME_TEXT },
  { label: '浅字', value: '#e2e8f0' },
  { label: '白字', value: '#f8fafc' },
  { label: '青字', value: '#bae6fd' },
  { label: '深字', value: '#0f172a' },
  { label: '墨字', value: '#334155' },
];

function clampFontSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_NOTE_CONTENT_STYLE.fontSize;
  return Math.min(32, Math.max(10, Math.round(parsed)));
}

function resolveThemeBackground(value) {
  if (!value || value === LEGACY_DEFAULT_BG) return NOTE_THEME_BG;
  return value;
}

function resolveThemeColor(value) {
  if (!value || value === LEGACY_DEFAULT_TEXT) return NOTE_THEME_TEXT;
  return value;
}

export function normalizeNoteContentStyle(style) {
  const base = { ...DEFAULT_NOTE_CONTENT_STYLE };
  if (!style || typeof style !== 'object') return base;

  return {
    fontSize: clampFontSize(style.fontSize ?? base.fontSize),
    fontWeight: style.fontWeight === 'bold' ? 'bold' : 'normal',
    fontStyle: style.fontStyle === 'italic' ? 'italic' : 'normal',
    backgroundColor: resolveThemeBackground(style.backgroundColor),
    color: resolveThemeColor(style.color),
  };
}

export function getNoteContentStyleCss(style) {
  const normalized = normalizeNoteContentStyle(style);

  return {
    fontSize: `${normalized.fontSize}px`,
    fontWeight: normalized.fontWeight,
    fontStyle: normalized.fontStyle,
    backgroundColor: normalized.backgroundColor,
    color: normalized.color,
  };
}

export function patchNoteContentStyle(current, patch) {
  return normalizeNoteContentStyle({
    ...normalizeNoteContentStyle(current),
    ...patch,
  });
}

export function isSameNoteBackground(a, b) {
  return (
    normalizeNoteContentStyle({ backgroundColor: a }).backgroundColor ===
    normalizeNoteContentStyle({ backgroundColor: b }).backgroundColor
  );
}

export function isSameNoteTextColor(a, b) {
  return (
    normalizeNoteContentStyle({ color: a }).color ===
    normalizeNoteContentStyle({ color: b }).color
  );
}
