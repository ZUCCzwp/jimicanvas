import { useEffect } from 'react';
import { Image as ImageIcon, Film, X } from 'lucide-react';
import { ImageToolbar, VideoToolbar } from './CanvasNode';

const NODE_META = {
  image: {
    icon: ImageIcon,
    title: '图片生成设置',
    subtitle: '参考图、提示词与模型参数',
  },
  video: {
    icon: Film,
    title: '视频生成设置',
    subtitle: '参考素材、提示词与模型参数',
  },
};

export function NodeSettingsModal({
  node,
  nodeType,
  textInputLinks = [],
  imageInputLinks = [],
  isRunning,
  isTranslating,
  onUpdateNode,
  onClose,
  onRunImageGeneration,
  onRunVideoGeneration,
  onOpenAssetLibrary,
  onRemoveImageReference,
  onRemoveTextReference,
  onRemoveVeoFrame,
  onRemoveSeedanceMedia,
  onVideoGenerationTypeChange,
}) {
  const meta = NODE_META[nodeType] || NODE_META.image;
  const Icon = meta.icon;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toolbarProps = {
    node,
    variant: 'modal',
    isRunning,
    isTranslating,
    textInputLinks,
    imageInputLinks,
    onUpdateNode,
    onOpenAssetLibrary,
    onRemoveImageReference,
    onRemoveTextReference,
  };

  return (
    <div className="asset-modal-backdrop" onPointerDown={onClose}>
      <section className="node-settings-modal" onPointerDown={(event) => event.stopPropagation()}>
        <header className="asset-modal-header">
          <div className="asset-modal-title">
            <Icon size={18} />
            <div>
              <strong>{node.title || meta.title}</strong>
              <span>{meta.subtitle}</span>
            </div>
          </div>
          <button className="panel-icon" onClick={onClose} title="关闭" type="button">
            <X size={16} />
          </button>
        </header>

        <div className="node-settings-modal-body">
          {nodeType === 'image' ? (
            <ImageToolbar
              {...toolbarProps}
              onRunImageGeneration={onRunImageGeneration}
            />
          ) : (
            <VideoToolbar
              {...toolbarProps}
              onRunVideoGeneration={onRunVideoGeneration}
              onRemoveVeoFrame={onRemoveVeoFrame}
              onRemoveSeedanceMedia={onRemoveSeedanceMedia}
              onVideoGenerationTypeChange={onVideoGenerationTypeChange}
            />
          )}
        </div>

        <footer className="asset-modal-footer">
          <span>Esc 关闭 · 修改会实时保存</span>
          <button className="icon-button primary" onClick={onClose} type="button">
            完成
          </button>
        </footer>
      </section>
    </div>
  );
}
