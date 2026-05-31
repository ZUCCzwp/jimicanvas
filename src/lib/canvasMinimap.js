import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
} from './constants';
import {
  getNodeBounds,
  getNodesContentBounds,
} from './canvas';

export const MINIMAP_WIDTH = 196;
export const MINIMAP_HEIGHT = 132;
export const MINIMAP_INNER_PADDING = 8;
export const MINIMAP_WORLD_PADDING = 120;
export const MINIMAP_MIN_WORLD_WIDTH = 480;
export const MINIMAP_MIN_WORLD_HEIGHT = 360;

export function getMinimapWorldBounds(
  nodes,
  viewportRect,
  {
    padding = MINIMAP_WORLD_PADDING,
    fallbackWidth = DEFAULT_NODE_WIDTH,
    fallbackHeight = DEFAULT_NODE_HEIGHT,
    minWidth = MINIMAP_MIN_WORLD_WIDTH,
    minHeight = MINIMAP_MIN_WORLD_HEIGHT,
  } = {}
) {
  const contentBounds = getNodesContentBounds(nodes, fallbackWidth, fallbackHeight);
  const viewport = viewportRect || { x: 0, y: 0, width: minWidth, height: minHeight };

  let minX = viewport.x;
  let minY = viewport.y;
  let maxX = viewport.x + viewport.width;
  let maxY = viewport.y + viewport.height;

  if (contentBounds) {
    minX = Math.min(minX, contentBounds.x - padding);
    minY = Math.min(minY, contentBounds.y - padding);
    maxX = Math.max(maxX, contentBounds.x + contentBounds.width + padding);
    maxY = Math.max(maxY, contentBounds.y + contentBounds.height + padding);
  } else {
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
  }

  const width = Math.max(minWidth, maxX - minX);
  const height = Math.max(minHeight, maxY - minY);

  return { x: minX, y: minY, width, height };
}

export function computeMinimapLayout(
  worldBounds,
  minimapWidth = MINIMAP_WIDTH,
  minimapHeight = MINIMAP_HEIGHT,
  innerPadding = MINIMAP_INNER_PADDING
) {
  const availableWidth = Math.max(1, minimapWidth - innerPadding * 2);
  const availableHeight = Math.max(1, minimapHeight - innerPadding * 2);
  const scale = Math.min(availableWidth / worldBounds.width, availableHeight / worldBounds.height);
  const contentWidth = worldBounds.width * scale;
  const contentHeight = worldBounds.height * scale;

  return {
    width: minimapWidth,
    height: minimapHeight,
    scale,
    offsetX: innerPadding + (availableWidth - contentWidth) / 2,
    offsetY: innerPadding + (availableHeight - contentHeight) / 2,
  };
}

export function canvasRectToMinimapRect(rect, worldBounds, layout) {
  const x = layout.offsetX + (rect.x - worldBounds.x) * layout.scale;
  const y = layout.offsetY + (rect.y - worldBounds.y) * layout.scale;
  const width = Math.max(2, rect.width * layout.scale);
  const height = Math.max(2, rect.height * layout.scale);

  return { x, y, width, height };
}

export function minimapPointToCanvasPoint(minimapX, minimapY, worldBounds, layout) {
  return {
    x: worldBounds.x + (minimapX - layout.offsetX) / layout.scale,
    y: worldBounds.y + (minimapY - layout.offsetY) / layout.scale,
  };
}

export function computeViewportCenterOffset(
  stageWidth,
  stageHeight,
  canvasScale,
  canvasCenterX,
  canvasCenterY
) {
  return {
    x: stageWidth / 2 - canvasCenterX * canvasScale,
    y: stageHeight / 2 - canvasCenterY * canvasScale,
  };
}

export function getMinimapNodeRects(
  nodes,
  worldBounds,
  layout,
  selectedNodeIds = [],
  fallbackWidth = DEFAULT_NODE_WIDTH,
  fallbackHeight = DEFAULT_NODE_HEIGHT
) {
  const selectedSet = new Set(selectedNodeIds);

  return nodes.map((node) => {
    const bounds = getNodeBounds(node, fallbackWidth, fallbackHeight);
    const rect = canvasRectToMinimapRect(bounds, worldBounds, layout);

    return {
      id: node.id,
      type: node.type || 'note',
      selected: selectedSet.has(node.id),
      ...rect,
    };
  });
}
