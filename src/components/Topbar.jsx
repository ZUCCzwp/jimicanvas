import { SquarePen, Wand2 } from 'lucide-react';

export function Topbar({
  activeCanvas,
  nodesCount,
  connectionsCount,
  onRenameCanvas,
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
        </div>
      </div>
    </header>
  );
}
