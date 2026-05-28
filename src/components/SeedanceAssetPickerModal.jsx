import { useRef } from 'react';
import {
  Check,
  Film,
  FolderOpen,
  Headphones,
  Image as ImageIcon,
  LoaderCircle,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { resolveSeedanceMediaPreviewUrl } from '../lib/videoApi';

const STATUS_LABELS = {
  Active: '已通过',
  Pending: '审核中',
  Failed: '未通过',
  Rejected: '已拒绝',
};

export function SeedanceAssetPickerModal({
  assets,
  loading,
  auditing,
  statusFilter = 'Active',
  search,
  selectedAssets,
  maxCount = 1,
  title = '满血版素材库',
  subtitle = '选择素材',
  mediaType = 'image',
  notice = '',
  onStatusFilterChange,
  onSearchChange,
  onToggleAsset,
  onUploadForAudit,
  onConfirm,
  onClose,
}) {
  const fileInputRef = useRef(null);
  const isVideo = mediaType === 'video';
  const isAudio = mediaType === 'audio';
  const canSelect = statusFilter === 'Active';

  const filteredAssets = assets.filter((asset) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return `${asset.name || ''} ${asset.assetId || ''}`.toLowerCase().includes(keyword);
  });

  const assetColumns = [[], [], [], []];
  filteredAssets.forEach((asset, index) => {
    assetColumns[index % assetColumns.length].push(asset);
  });

  function handlePick(asset) {
    if (!canSelect || asset.status !== 'Active') return;
    onToggleAsset(asset);
  }

  return (
    <div className="asset-modal-backdrop" onPointerDown={onClose}>
      <section
        className="asset-modal seedance-asset-modal"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="asset-modal-header">
          <div className="asset-modal-title">
            <FolderOpen size={18} />
            <div>
              <strong>{title}</strong>
              <span>{subtitle}</span>
            </div>
          </div>
          <button className="panel-icon" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="asset-modal-toolbar seedance-asset-toolbar">
          <div className="seedance-status-tabs">
            <button
              type="button"
              className={statusFilter === 'Active' ? 'active' : ''}
              onClick={() => onStatusFilterChange('Active')}
            >
              已通过
            </button>
            <button
              type="button"
              className={statusFilter === 'Pending' ? 'active' : ''}
              onClick={() => onStatusFilterChange('Pending')}
            >
              审核中
            </button>
          </div>
          <label className="asset-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜索素材"
            />
          </label>
          <button
            type="button"
            className="icon-button asset-upload-button seedance-upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={auditing}
            title="上传本地文件并提交审核"
          >
            {auditing ? <LoaderCircle size={14} className="spin-icon" /> : <Upload size={14} />}
            {auditing ? '审核中…' : '上传并审核'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={isVideo ? 'video/*' : isAudio ? 'audio/*' : 'image/*'}
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              if (files.length > 0) {
                onUploadForAudit(files);
              }
              event.target.value = '';
            }}
          />
        </div>

        {notice ? <p className="seedance-asset-notice">{notice}</p> : null}
        <p className="seedance-asset-tip">
          {canSelect
            ? '仅「已通过」素材可用于生成；上传后自动提交审核，通过后即可选择。'
            : '审核中的素材暂不可选，请等待审核完成或切换到「已通过」。'}
        </p>

        <div className="asset-grid seedance-asset-grid">
          {loading || auditing ? (
            <div className="asset-empty">
              <LoaderCircle size={24} className="spin-icon" />
              {auditing ? '正在上传并等待审核…' : '正在加载'}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="asset-empty">
              {isVideo ? '暂无视频素材' : isAudio ? '暂无音频素材' : '暂无图片素材'}
              <span className="asset-empty-hint">可点击「上传并审核」添加</span>
            </div>
          ) : (
            assetColumns.map((column, columnIndex) => (
              <div className="asset-column" key={`seedance-column-${columnIndex}`}>
                {column.map((asset) => {
                  const selected = selectedAssets.some(
                    (item) => item.assetId === asset.assetId || item.id === asset.id
                  );
                  const previewUrl = resolveSeedanceMediaPreviewUrl(asset, mediaType);
                  const selectable = canSelect && asset.status === 'Active';
                  const statusLabel = STATUS_LABELS[asset.status] || asset.status;

                  return (
                    <button
                      key={asset.assetId || asset.id}
                      type="button"
                      className={`asset-card seedance-asset-card ${selected ? 'selected' : ''} ${
                        selectable ? '' : 'is-disabled'
                      }`}
                      onClick={() => handlePick(asset)}
                      title={asset.name}
                      disabled={!selectable}
                    >
                      <div className="seedance-asset-preview">
                        {isVideo && previewUrl ? (
                          <video src={previewUrl} muted playsInline preload="metadata" />
                        ) : isAudio && previewUrl ? (
                          <div className="asset-audio-preview asset-audio-preview-playable">
                            <audio
                              src={previewUrl}
                              controls
                              preload="metadata"
                              onClick={(event) => event.stopPropagation()}
                            />
                          </div>
                        ) : isAudio ? (
                          <div className="asset-audio-preview">
                            <Headphones size={22} />
                          </div>
                        ) : previewUrl ? (
                          <img src={previewUrl} alt={asset.name || '素材'} />
                        ) : (
                          <div className="asset-audio-preview">
                            {isVideo ? <Film size={22} /> : <ImageIcon size={22} />}
                          </div>
                        )}
                        {asset.status && asset.status !== 'Active' ? (
                          <span className={`seedance-asset-status is-${asset.status.toLowerCase()}`}>
                            {statusLabel}
                          </span>
                        ) : null}
                        {selected ? (
                          <div className="asset-selected-mark">
                            <Check size={14} />
                          </div>
                        ) : null}
                      </div>
                      <span>{asset.name || '素材'}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <footer className="asset-modal-footer">
          <span>
            已选择 {selectedAssets.length}/{maxCount}
          </span>
          <div>
            <button type="button" className="icon-button" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="icon-button primary"
              onClick={onConfirm}
              disabled={selectedAssets.length === 0}
            >
              确认选择
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
