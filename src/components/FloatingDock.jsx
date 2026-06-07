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

      <button className="dock-button" onClick={onUploadMedia} title="上传图片/视频并生成节点">
        <Upload size={18} />
      </button>

      <div className="dock-divider" />

      {onOpenWorkflowTemplates ? (
        <button className="dock-button" onClick={onOpenWorkflowTemplates} title="预设工作流模版">
          <Workflow size={18} />
        </button>
      ) : null}

      <button className="dock-button" onClick={onImport} title="导入画布">
        <FileUp size={18} />
      </button>
      <button className="dock-button" onClick={onExport} title="导出画布">
        <Download size={18} />
      </button>
    </aside>
  );
}
