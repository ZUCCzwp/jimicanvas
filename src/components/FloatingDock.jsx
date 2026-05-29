import {
  Download,
  FileText,
  FileUp,
  Film,
  Headphones,
  Image as ImageIcon,
} from 'lucide-react';

export function FloatingDock({ onAddNode, onImport, onExport }) {
  return (
    <aside className="floating-dock" onPointerDown={(event) => event.stopPropagation()}>
      <button className="dock-button" onClick={() => onAddNode('note')} title="文本节点">
        <FileText size={18} />
      </button>
      <button className="dock-button" onClick={() => onAddNode('image')} title="图片节点">
        <ImageIcon size={18} />
      </button>
      <button className="dock-button" onClick={() => onAddNode('video')} title="视频节点">
        <Film size={18} />
      </button>
      <button className="dock-button" onClick={() => onAddNode('audio')} title="音频节点">
        <Headphones size={18} />
      </button>

      <div className="dock-divider" />

      <button className="dock-button" onClick={onImport} title="导入画布">
        <FileUp size={18} />
      </button>
      <button className="dock-button" onClick={onExport} title="导出画布">
        <Download size={18} />
      </button>
    </aside>
  );
}
