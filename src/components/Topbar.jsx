import { Link2, RotateCcw, SquarePen, Wand2, ZoomIn, ZoomOut } from 'lucide-react';
import { CANVAS_SCALE_STEP, MAX_CANVAS_SCALE, MIN_CANVAS_SCALE } from '../lib/constants';

export function Topbar({
  activeCanvas,
  nodesCount,
  connectionsCount,
  canvasScalePercent,
  linkFromNodeId,
  onRenameCanvas,
  onZoom,
  onScaleChange,
  onResetScale,
  onCancelLink,
}) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="brand-mark">
          <Wand2 size={18} />
        </div>
        <div className="brand-copy">
          <strong>JimiCanvas</strong>
          <span>轻量画布工作台</span>
        </div>
      </div>

      <div className="topbar-meta">
        <div className="canvas-meta">
          <SquarePen size={16} />
          <input
            className="canvas-name"
            value={activeCanvas?.name || ''}
            onChange={(event) => onRenameCanvas(event.target.value)}
          />
          <span className="meta-pill">{nodesCount} 节点</span>
          <span className="meta-pill">{connectionsCount} 连线</span>
        </div>

        <div className="toolbar-row">
          <span className="save-chip">本地自动保存</span>
          <div className="zoom-control" aria-label="画布缩放">
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
          <button className={`icon-button ${linkFromNodeId ? 'primary' : ''}`} onClick={onCancelLink}>
            <Link2 size={16} />
            {linkFromNodeId ? '取消连线' : '等待连线'}
          </button>
        </div>
      </div>
    </header>
  );
}
