import {
  DEFAULT_VIDEO_FAMILY,
  DEFAULT_VIDEO_RATIO,
  getDefaultVideoOrientation,
} from './constants';
import { buildImageNodeLayoutPatch, parseRatioValue } from './imageNodeLayout';

export function resolveVideoAspectRatio(node = {}) {
  const family = node.videoFamily || DEFAULT_VIDEO_FAMILY;

  if (family === 'sora') {
    const orientation = node.videoOrientation || getDefaultVideoOrientation('sora');
    return orientation === 'portrait'
      ? { width: 9, height: 16 }
      : { width: 16, height: 9 };
  }

  const size = String(node.videoSize || '').toLowerCase();
  const match = size.match(/^(\d+)x(\d+)$/);
  if (match) {
    return {
      width: Math.max(1, Number(match[1]) || 1),
      height: Math.max(1, Number(match[2]) || 1),
    };
  }

  return parseRatioValue(node.videoRatio || DEFAULT_VIDEO_RATIO);
}

export function buildVideoNodeLayoutPatch(node = {}, aspectOverride = null) {
  const aspect =
    aspectOverride?.width && aspectOverride?.height
      ? {
          width: Math.max(1, Number(aspectOverride.width) || 1),
          height: Math.max(1, Number(aspectOverride.height) || 1),
        }
      : resolveVideoAspectRatio(node);

  return buildImageNodeLayoutPatch({
    imageCount: 1,
    aspectWidth: aspect.width,
    aspectHeight: aspect.height,
    baseWidth: 200,
  });
}

export async function resolveVideoOutputLayout(node = {}) {
  return buildVideoNodeLayoutPatch(node);
}
