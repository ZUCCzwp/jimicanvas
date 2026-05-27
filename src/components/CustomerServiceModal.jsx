import { MessageCircle, X } from 'lucide-react';
import { DEFAULT_KEFU_QR_URL } from '../lib/constants';

export function CustomerServiceModal({ qrUrl, onClose }) {
  const imageUrl = qrUrl || DEFAULT_KEFU_QR_URL;

  return (
    <div className="asset-modal-backdrop" onPointerDown={onClose}>
      <div
        className="customer-service-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-service-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="asset-modal-header customer-service-header">
          <div className="asset-modal-title">
            <MessageCircle size={18} aria-hidden="true" />
            <div>
              <strong id="customer-service-title">联系客服</strong>
              <span>扫码添加微信客服</span>
            </div>
          </div>
          <button type="button" className="icon-mini" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="customer-service-body">
          <img src={imageUrl} alt="微信客服二维码" className="customer-service-qr" />
          <p className="customer-service-hint">使用微信扫描二维码，联系客服获取帮助</p>
        </div>
      </div>
    </div>
  );
}
