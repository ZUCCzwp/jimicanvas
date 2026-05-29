import { DEFAULT_IMAGE_RATIO } from './constants';
import { normalizeImageUrl } from './imageApi';

export const IMAGE_OUTPUT_BASE_WIDTH = 320;
export const IMAGE_OUTPUT_MIN_WIDTH = 180;
export const IMAGE_OUTPUT_MAX_WIDTH = 520;
export const IMAGE_OUTPUT_MIN_HEIGHT = 120;
export const IMAGE_OUTPUT_MAX_HEIGHT = 560;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function parseRatioValue(value = DEFAULT_IMAGE_RATIO) {
  const parts = String(value || DEFAULT_IMAGE_RATIO).split(':');
  return {
    width: Math.max(1, Number(parts[0]) || 1),
    height: Math.max(1, Number(parts[1]) || 1),
  };
}

export function getImageGridShape(imageCount = 1) {
  const count = Math.max(1, Math.min(Number(imageCount) || 1, 4));
  if (count <= 1) {
    return { columns: 1, rows: 1, count };
  }

  return {
    columns: 2,
    rows: Math.ceil(count / 2),
    count,
  };
}

export function computeImageOutputSize({
  aspectWidth,
  aspectHeight,
  imageCount = 1,
  baseWidth = IMAGE_OUTPUT_BASE_WIDTH,
}) {
  const safeAspectWidth = Math.max(1, Number(aspectWidth) || 1);
  const safeAspectHeight = Math.max(1, Number(aspectHeight) || 1);
  const { columns, rows } = getImageGridShape(imageCount);
  const width = clamp(Math.round(baseWidth), IMAGE_OUTPUT_MIN_WIDTH, IMAGE_OUTPUT_MAX_WIDTH);
  const cellWidth = width / columns;
  const cellHeight = cellWidth / (safeAspectWidth / safeAspectHeight);
  const height = clamp(Math.round(cellHeight * rows), IMAGE_OUTPUT_MIN_HEIGHT, IMAGE_OUTPUT_MAX_HEIGHT);

  return {
    width,
    height,
    columns,
    rows,
    cssAspectRatio: `${safeAspectWidth} / ${safeAspectHeight}`,
  };
}

export function measureImageNaturalSize(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      resolve({
        width: Math.max(1, image.naturalWidth || 1),
        height: Math.max(1, image.naturalHeight || 1),
      });
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = normalizeImageUrl(url);
  });
}

export function buildImageNodeLayoutPatch({
  imageRatio,
  imageCount = 1,
  aspectWidth,
  aspectHeight,
  baseWidth = IMAGE_OUTPUT_BASE_WIDTH,
}) {
  const count = Math.max(1, Math.min(Number(imageCount) || 1, 4));
  const ratio =
    aspectWidth && aspectHeight
      ? { width: aspectWidth, height: aspectHeight }
      : parseRatioValue(imageRatio);
  const layout = computeImageOutputSize({
    aspectWidth: ratio.width,
    aspectHeight: ratio.height,
    imageCount: count,
    baseWidth,
  });

  return {
    width: layout.width,
    height: layout.height,
    outputAspectCss: layout.cssAspectRatio,
  };
}

export async function resolveImageOutputLayout({ imageUrls = [], imageRatio, imageCount }) {
  const count = imageUrls.length > 0 ? imageUrls.length : Math.max(1, Number(imageCount) || 1);

  if (imageUrls.length > 0) {
    try {
      const natural = await measureImageNaturalSize(imageUrls[0]);
      return buildImageNodeLayoutPatch({
        imageCount: count,
        aspectWidth: natural.width,
        aspectHeight: natural.height,
      });
    } catch {
      // Fall back to configured ratio when the image cannot be measured.
    }
  }

  return buildImageNodeLayoutPatch({ imageRatio, imageCount: count });
}

const SPLIT_NODE_GAP = 36;

export function computeSplitImageNodePositions({
  originX,
  originY,
  originWidth,
  cols,
  rows,
  nodeWidth,
  nodeHeight,
  gap = SPLIT_NODE_GAP,
}) {
  const startX = originX + originWidth + gap;
  const startY = originY;
  const positions = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      positions.push({
        x: startX + c * (nodeWidth + gap),
        y: startY + r * (nodeHeight + gap),
      });
    }
  }

  return positions;
}

export function formatCellAspectRatio(cellWidth, cellHeight) {
  const width = Math.max(1, Math.round(Number(cellWidth) || 1));
  const height = Math.max(1, Math.round(Number(cellHeight) || 1));
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}
