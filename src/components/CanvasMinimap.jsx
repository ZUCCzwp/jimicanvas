import { useMemo, useRef, useState } from 'react';
import { getViewportRectInCanvas } from '../lib/canvas';
import {
  MINIMAP_HEIGHT,
  MINIMAP_WIDTH,
  computeMinimapLayout,
  computeViewportCenterOffset,
  canvasRectToMinimapRect,
  getMinimapNodeRects,
  getMinimapWorldBounds,
  minimapPointToCanvasPoint,
} from '../lib/canvasMinimap';

function getLocalMinimapPoint(event, mapElement, layout) {
  const rect = mapElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  return {
    x: ((event.clientX - rect.left) / rect.width) * layout.width,
    y: ((event.clientY - rect.top) / rect.height) * layout.height,
  };
}

export function CanvasMinimap({
  nodes,
  selectedNodeIds = [],
  stageWidth,
  stageHeight,
  canvasScale,
  viewportOffset,
  onViewportChange,
  disabled = false,
}) {
  const mapRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const viewportRect = useMemo(
    () =>
      getViewportRectInCanvas(
        stageWidth,
        stageHeight,
        canvasScale,
        viewportOffset.x,
        viewportOffset.y
      ),
    [canvasScale, stageHeight, stageWidth, viewportOffset.x, viewportOffset.y]
  );

  const worldBounds = useMemo(
    () => getMinimapWorldBounds(nodes, viewportRect),
    [nodes, viewportRect]
  );

  const layout = useMemo(
    () => computeMinimapLayout(worldBounds, MINIMAP_WIDTH, MINIMAP_HEIGHT),
    [worldBounds]
  );

  const nodeRects = useMemo(
    () => getMinimapNodeRects(nodes, worldBounds, layout, selectedNodeIds),
    [layout, nodes, selectedNodeIds, worldBounds]
  );

  const viewportMiniRect = useMemo(
    () => canvasRectToMinimapRect(viewportRect, worldBounds, layout),
    [layout, viewportRect, worldBounds]
  );

  function navigateToMinimapPoint(event) {
    if (disabled || !mapRef.current) return;

    const localPoint = getLocalMinimapPoint(event, mapRef.current, layout);
    if (!localPoint) return;

    const canvasPoint = minimapPointToCanvasPoint(
      localPoint.x,
      localPoint.y,
      worldBounds,
      layout
    );

    onViewportChange(
      computeViewportCenterOffset(
        stageWidth,
        stageHeight,
        canvasScale,
        canvasPoint.x,
        canvasPoint.y
      )
    );
  }

  function handlePointerDown(event) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    navigateToMinimapPoint(event);
  }

  function handlePointerMove(event) {
    if (!dragging || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    navigateToMinimapPoint(event);
  }

  function handlePointerUp(event) {
    if (!dragging) return;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  if (stageWidth <= 0 || stageHeight <= 0) return null;

  return (
    <div
      className={`canvas-minimap ${dragging ? 'is-dragging' : ''}`}
      aria-label="画布俯瞰缩略图"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="canvas-minimap-header">俯瞰</div>
      <div
        ref={mapRef}
        className="canvas-minimap-map"
        role="presentation"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <svg
          className="canvas-minimap-svg"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
        >
          <rect
            className="canvas-minimap-world"
            x={layout.offsetX}
            y={layout.offsetY}
            width={worldBounds.width * layout.scale}
            height={worldBounds.height * layout.scale}
            rx="6"
          />

          {nodeRects.map((nodeRect) => (
            <rect
              key={nodeRect.id}
              className={`canvas-minimap-node canvas-minimap-node-${nodeRect.type} ${
                nodeRect.selected ? 'selected' : ''
              }`}
              x={nodeRect.x}
              y={nodeRect.y}
              width={nodeRect.width}
              height={nodeRect.height}
              rx="2"
            />
          ))}

          <rect
            className="canvas-minimap-viewport"
            x={viewportMiniRect.x}
            y={viewportMiniRect.y}
            width={viewportMiniRect.width}
            height={viewportMiniRect.height}
            rx="3"
          />
        </svg>
      </div>
    </div>
  );
}
