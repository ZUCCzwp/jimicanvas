import { useRef } from 'react';
import { Check, FolderOpen, Image as ImageIcon, LoaderCircle, Search, Sparkles, Upload, X } from 'lucide-react';
import { normalizeImageUrl } from '../lib/imageApi';

export function AssetPickerModal({
  assets,
  loading,
  source,
  search,
  selectedAssets,
  maxCount = 5,
  onSourceChange,
  onSearchChange,
  onToggleAsset,
  onUploadImages,
  onConfirm,
  onClose,
}) {
  const fileInputRef = useRef(null);
  const filteredAssets = assets.filter((asset) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return `${asset.name || ''} ${asset.url || ''}`.toLowerCase().includes(keyword);
  });
  const assetColumns = [[], [], [], []];

  filteredAssets.forEach((asset, index) => {
    assetColumns[index % assetColumns.length].push(asset);
  });

  return (
    <div className="asset-modal-backdrop" onPointerDown={onClose}>
      <section className="asset-modal" onPointerDown={(event) => event.stopPropagation()}>
        <header className="asset-modal-header">
          <div className="asset-modal-title">
            <FolderOpen size={18} />
            <div>
              <strong>资产库</strong>
              <span>选择图片作为参考图</span>
            </div>
          </div>
          <button className="panel-icon" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="asset-modal-toolbar">
          <div className="asset-source-tabs">
            <button
              className={source === 'local' ? 'active' : ''}
              onClick={() => onSourceChange('local')}
            >
              <ImageIcon size={14} />
              我的资产
            </button>
            <button
              className={source === 'ai' ? 'active' : ''}
              onClick={() => onSourceChange('ai')}
            >
              <Sparkles size={14} />
              AI 图片
            </button>
          </div>
          <label className="asset-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜索资产"
            />
          </label>
          <button
            className="icon-button asset-upload-button"
            onClick={() => fileInputRef.current?.click()}
            title="上传图片"
          >
            <Upload size={14} />
            上传图片
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              if (files.length > 0) {
                onUploadImages(files);
              }
              event.target.value = '';
            }}
          />
        </div>

        <div className="asset-grid">
          {loading ? (
            <div className="asset-empty">
              <LoaderCircle size={24} className="spin-icon" />
              正在加载
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="asset-empty">暂无图片资产</div>
          ) : (
            assetColumns.map((column, columnIndex) => (
              <div className="asset-column" key={`asset-column-${columnIndex}`}>
                {column.map((asset) => {
                  const selected = selectedAssets.some((item) => item.id === asset.id);
                  return (
                    <button
                      key={asset.id || asset.url}
                      className={`asset-card ${selected ? 'selected' : ''}`}
                      onClick={() => onToggleAsset(asset)}
                      title={asset.name}
                    >
                      <img
                        src={source === 'local' ? asset.url : normalizeImageUrl(asset.url)}
                        alt={asset.name || '图片资产'}
                      />
                      <span>{asset.name || '图片资产'}</span>
                      {selected ? (
                        <div className="asset-selected-mark">
                          <Check size={14} />
                        </div>
                      ) : null}
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
            <button className="icon-button" onClick={onClose}>
              取消
            </button>
            <button
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
