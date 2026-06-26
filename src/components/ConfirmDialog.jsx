import { useEffect } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onCancel?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="asset-modal-backdrop confirm-dialog-backdrop" onPointerDown={loading ? undefined : onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="confirm-dialog-header">
          <div className="confirm-dialog-title">
            <span className={`confirm-dialog-icon confirm-dialog-icon-${variant}`} aria-hidden="true">
              <AlertTriangle size={18} />
            </span>
            <strong id="confirm-dialog-title">{title}</strong>
          </div>
          <button
            type="button"
            className="icon-mini"
            onClick={onCancel}
            disabled={loading}
            aria-label={cancelLabel}
          >
            <X size={16} />
          </button>
        </header>

        <div id="confirm-dialog-message" className="confirm-dialog-message">
          {message}
        </div>

        <footer className="confirm-dialog-footer">
          <button type="button" className="confirm-dialog-btn" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn confirm-dialog-btn-confirm confirm-dialog-btn-${variant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
