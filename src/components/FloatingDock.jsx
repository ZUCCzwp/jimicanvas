import {
  Download,
  FileText,
  FileUp,
  Film,
  Headphones,
  Image as ImageIcon,
  Workflow,
  Upload,
} from 'lucide-react';

export function FloatingDock({
  onAddNode,
  onImport,
  onExport,
  onOpenWorkflowTemplates,
  onUploadMedia,
}) {
  return (
    <aside className="floating-dock" onPointerDown={(event) => event.stopPropagation()}>
      <div className="dock-item-wrapper">
        <button className="dock-button" onClick={() => onAddNode('note')}>
          <FileText size={18} />
        </button>
        <span className="dock-tooltip">文本节点</span>
      </div>

      <div className="dock-item-wrapper">
        <button className="dock-button" onClick={() => onAddNode('image')}>
          <ImageIcon size={18} />
        </button>
        <span className="dock-tooltip">图片节点</span>
      </div>

      <div className="dock-item-wrapper">
        <button className="dock-button" onClick={() => onAddNode('video')}>
          <Film size={18} />
        </button>
        <span className="dock-tooltip">视频节点</span>
      </div>

      <div className="dock-item-wrapper">
        <button className="dock-button" onClick={() => onAddNode('audio')}>
          <Headphones size={18} />
        </button>
        <span className="dock-tooltip">音频节点</span>
      </div>

      <div className="dock-divider" />

      <div className="dock-item-wrapper">
        <button className="dock-button" onClick={onUploadMedia}>
          <Upload size={18} />
        </button>
        <span className="dock-tooltip">上传媒体生成节点</span>
      </div>

      <div className="dock-divider" />

      {onOpenWorkflowTemplates ? (
        <div className="dock-item-wrapper">
          <button className="dock-button" onClick={onOpenWorkflowTemplates}>
            <Workflow size={18} />
          </button>
          <span className="dock-tooltip">工作流模版</span>
        </div>
      ) : null}

      <div className="dock-item-wrapper">
        <button className="dock-button" onClick={onImport}>
          <FileUp size={18} />
        </button>
        <span className="dock-tooltip">导入画布</span>
      </div>

      <div className="dock-item-wrapper">
        <button className="dock-button" onClick={onExport}>
          <Download size={18} />
        </button>
        <span className="dock-tooltip">导出画布</span>
      </div>
    </aside>
  );
}
