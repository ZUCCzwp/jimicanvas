import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { CANVAS_SCALE_STEP, MAX_CANVAS_SCALE, MIN_CANVAS_SCALE } from '../lib/constants';

export function CanvasZoomControls({
  canvasScalePercent,
  onZoom,
  onScaleChange,
  onResetScale,
}) {
  return (
    <div
      className="stage-zoom-control zoom-control"
      aria-label="画布缩放"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button className="icon-mini" onClick={() => onZoom(-CANVAS_SCALE_STEP)} title="缩小画布">
        <ZoomOut size={14} />
      </button>
      <input
        className="zoom-slider"
        type="range"
        min={MIN_CANVAS_SCALE * 100}
        max={MAX_CANVAS_SCALE * 100}
        step={CANVAS_SCALE_STEP * 100}
        value={canvasScalePercent}
        onChange={(event) => onScaleChange(Number(event.target.value) / 100)}
        aria-label="画布缩放比例"
      />
      <button className="icon-mini" onClick={() => onZoom(CANVAS_SCALE_STEP)} title="放大画布">
        <ZoomIn size={14} />
      </button>
      <button className="icon-mini" onClick={onResetScale} title="重置比例">
        <RotateCcw size={14} />
      </button>
      <span className="meta-pill zoom-label">{canvasScalePercent}%</span>
    </div>
  );
}
