import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, X } from 'lucide-react';
import { normalizeImageUrl } from '../lib/imageApi';

export function ImagePreviewModal({ images, activeIndex, title, onSelectIndex, onDownload, onClose }) {
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(images.length - 1, 0));
  const activeUrl = images[safeIndex];
  const hasMultiple = images.length > 1;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (!hasMultiple) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onSelectIndex((safeIndex - 1 + images.length) % images.length);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onSelectIndex((safeIndex + 1) % images.length);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasMultiple, images.length, onClose, onSelectIndex, safeIndex]);

  if (!activeUrl) return null;

  return (
    <div className="asset-modal-backdrop image-preview-backdrop" onPointerDown={onClose}>
      <section className="image-preview-modal" onPointerDown={(event) => event.stopPropagation()}>
        <header className="image-preview-header">
          <div className="asset-modal-title">
            <ImageIcon size={18} />
            <div>
              <strong>{title || '图片预览'}</strong>
              {hasMultiple ? (
                <span>
                  {safeIndex + 1} / {images.length}
                </span>
              ) : (
                <span>点击查看大图</span>
              )}
            </div>
          </div>
          <div className="image-preview-header-actions">
            {onDownload ? (
              <button
                type="button"
                className="panel-icon"
                onClick={() => onDownload([activeUrl], title)}
                title="下载当前图片"
              >
                <Download size={16} />
              </button>
            ) : null}
            <button type="button" className="panel-icon" onClick={onClose} title="关闭">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="image-preview-stage">
          {hasMultiple ? (
            <button
              type="button"
              className="image-preview-nav prev"
              onClick={() => onSelectIndex((safeIndex - 1 + images.length) % images.length)}
              title="上一张"
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}
          <img src={normalizeImageUrl(activeUrl)} alt={`${title || '图片'} ${safeIndex + 1}`} />
          {hasMultiple ? (
            <button
              type="button"
              className="image-preview-nav next"
              onClick={() => onSelectIndex((safeIndex + 1) % images.length)}
              title="下一张"
            >
              <ChevronRight size={22} />
            </button>
          ) : null}
        </div>

        {hasMultiple ? (
          <footer className="image-preview-thumbs">
            {images.map((imageUrl, index) => (
              <button
                key={`${imageUrl}-${index}`}
                type="button"
                className={`image-preview-thumb ${index === safeIndex ? 'active' : ''}`}
                onClick={() => onSelectIndex(index)}
                title={`查看第 ${index + 1} 张`}
              >
                <img src={normalizeImageUrl(imageUrl)} alt={`缩略图 ${index + 1}`} />
              </button>
            ))}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
