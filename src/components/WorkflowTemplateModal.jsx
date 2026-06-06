import { Clapperboard, FileText, Film, Image as ImageIcon, Layers, ScanSearch, X } from 'lucide-react';
import { WORKFLOW_TEMPLATES } from '../lib/workflowTemplates';

const TEMPLATE_ICONS = {
  image: ImageIcon,
  video: Film,
  scan: ScanSearch,
  'video-scan': Clapperboard,
  layers: Layers,
  note: FileText,
};

export function WorkflowTemplateModal({ isOpen, onClose, onSelect, mode = 'create' }) {
  if (!isOpen) return null;

  const title = mode === 'insert' ? '插入工作流模版' : '预设工作流模版';
  const subtitle =
    mode === 'insert'
      ? '选择模版，将节点与连线插入当前画布'
      : '选择模版，快速搭建常用 AI 创作流程';

  return (
    <div className="asset-modal-backdrop" onPointerDown={onClose}>
      <div
        className="workflow-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-template-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="workflow-template-header">
          <div>
            <h3 id="workflow-template-title">{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="icon-mini" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        <div className="workflow-template-grid">
          {WORKFLOW_TEMPLATES.map((template) => {
            const Icon = TEMPLATE_ICONS[template.icon] || ImageIcon;
            return (
              <button
                key={template.id}
                type="button"
                className="workflow-template-card"
                onClick={() => onSelect(template.id)}
              >
                <span className={`workflow-template-icon icon-${template.icon}`}>
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className="workflow-template-card-body">
                  <strong>{template.name}</strong>
                  <span>{template.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
