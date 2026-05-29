import { Plus, SquarePen, Trash2, X } from 'lucide-react';

export function CanvasPanel({
  documents,
  activeCanvasId,
  onCreateCanvas,
  onSelectCanvas,
  onDeleteCanvas,
  onClose,
}) {
  return (
    <section className="canvas-panel" onPointerDown={(event) => event.stopPropagation()}>
      <header className="panel-header">
        <div className="panel-title">
          <SquarePen size={15} />
          画布管理
        </div>
        <div className="panel-actions">
          <button className="panel-icon success" onClick={onCreateCanvas} title="新增画布">
            <Plus size={15} />
          </button>
          <button className="panel-icon" onClick={onClose} title="关闭">
            <X size={15} />
          </button>
        </div>
      </header>

      <div className="canvas-panel-list">
        {[...documents]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((doc) => (
            <div
              key={doc.id}
              className={`panel-canvas-item ${doc.id === activeCanvasId ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCanvas(doc.id)}
            >
              <div className="panel-canvas-copy">
                <strong>
                  {doc.name}
                  {doc.id === activeCanvasId ? <span>当前</span> : null}
                </strong>
                <small>
                  {doc.nodes.length} 个节点 · {new Date(doc.updatedAt).toLocaleDateString()}
                </small>
              </div>
              <button
                className="panel-delete"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteCanvas(doc.id);
                }}
                title="删除画布"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
      </div>
    </section>
  );
}
