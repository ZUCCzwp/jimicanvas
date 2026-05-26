import { useEffect } from 'react';
import { Film, X } from 'lucide-react';
import { normalizeVideoUrl } from '../lib/videoApi';

export function VideoPreviewModal({ videoUrl, title, onClose }) {
  const src = normalizeVideoUrl(videoUrl);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!src) return null;

  return (
    <div className="asset-modal-backdrop image-preview-backdrop" onPointerDown={onClose}>
      <section className="image-preview-modal video-preview-modal" onPointerDown={(event) => event.stopPropagation()}>
        <header className="image-preview-header">
          <div className="asset-modal-title">
            <Film size={18} />
            <div>
              <strong>{title || '视频预览'}</strong>
              <span>支持播放控制</span>
            </div>
          </div>
          <button type="button" className="panel-icon" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="image-preview-stage video-preview-stage">
          <video key={src} src={src} controls playsInline autoPlay />
        </div>
      </section>
    </div>
  );
}
