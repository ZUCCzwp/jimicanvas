import { FileText, Film, Headphones, Image as ImageIcon, X } from 'lucide-react';

const NODE_OPTIONS = [
  { type: 'note', label: '文本节点', icon: FileText },
  { type: 'image', label: '图片节点', icon: ImageIcon },
  { type: 'video', label: '视频节点', icon: Film },
  { type: 'audio', label: '音频节点', icon: Headphones },
];

export function NodeTypePickerPopover({ screenX, screenY, onSelect, onClose }) {
  return (
    <div className="node-type-picker-backdrop" onPointerDown={onClose}>
      <div
        className="node-type-picker"
        style={{ left: screenX, top: screenY }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="node-type-picker-header">
          <strong>选择节点类型</strong>
          <button type="button" className="panel-icon" onClick={onClose} title="取消">
            <X size={14} />
          </button>
        </header>
        <div className="node-type-picker-options">
          {NODE_OPTIONS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              className="node-type-picker-option"
              onClick={() => onSelect(type)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
