import { useRef } from 'react';
import { Check, Film, FolderOpen, Headphones, Image as ImageIcon, LoaderCircle, Search, Sparkles, Upload, X } from 'lucide-react';
import { normalizeImageUrl } from '../lib/imageApi';
import { AUDIO_FILE_ACCEPT, filterAudioFiles, isAudioAssetRecord, normalizeAudioUrl } from '../lib/audioApi';
import { normalizeVideoUrl, resolveSeedanceMediaPreviewUrl } from '../lib/videoApi';

export function AssetPickerModal({
  assets,
  loading,
  source,
  search,
  selectedAssets,
  maxCount = 5,
  title = '资产库',
  subtitle = '选择图片作为参考图',
  mediaType = 'image',
  libraryOnly = false,
  onSourceChange,
  onSearchChange,
  onToggleAsset,
  onUploadImages,
  onConfirm,
  onClose,
}) {
  const fileInputRef = useRef(null);
  const isVideo = mediaType === 'video';
  const isAudio = mediaType === 'audio';
  const filteredAssets = assets.filter((asset) => {
    if (isAudio && !isAudioAssetRecord(asset)) return false;
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
      <section
        className={`asset-modal ${isAudio ? 'asset-modal-audio' : ''}`}
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

        <div className={`asset-modal-toolbar ${libraryOnly ? 'library-only' : ''}`}>
          {libraryOnly ? (
            <p className="asset-library-tip">仅展示满血版素材库中已审核通过的素材</p>
          ) : null}
          {!libraryOnly ? (
            <div className="asset-source-tabs">
              <button
                className={source === 'local' ? 'active' : ''}
                onClick={() => onSourceChange('local')}
              >
                {isVideo ? <Film size={14} /> : isAudio ? <Headphones size={14} /> : <ImageIcon size={14} />}
                我的资产
              </button>
              {!isVideo && !isAudio ? (
                <button
                  className={source === 'ai' ? 'active' : ''}
                  onClick={() => onSourceChange('ai')}
                >
                  <Sparkles size={14} />
                  AI 图片
                </button>
              ) : null}
            </div>
          ) : null}
          <label className="asset-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜索资产"
            />
          </label>
          {!libraryOnly ? (
            <button
              className="icon-button asset-upload-button"
              onClick={() => fileInputRef.current?.click()}
              title={isVideo ? '上传视频' : isAudio ? '上传音频' : '上传图片'}
            >
              <Upload size={14} />
              {isVideo ? '上传视频' : isAudio ? '上传音频' : '上传图片'}
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept={isVideo ? 'video/*' : isAudio ? AUDIO_FILE_ACCEPT : 'image/*'}
            multiple={!isVideo && !isAudio && maxCount > 1}
            hidden
            onChange={(event) => {
              const picked = Array.from(event.target.files || []);
              const files = isAudio ? filterAudioFiles(picked) : picked;
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
            <div className="asset-empty">
              {isVideo ? '暂无视频资产' : isAudio ? '暂无音频资产' : '暂无图片资产'}
            </div>
          ) : (
            assetColumns.map((column, columnIndex) => (
              <div className="asset-column" key={`asset-column-${columnIndex}`}>
                {column.map((asset) => {
                  const selected = selectedAssets.some((item) => item.id === asset.id);
                  const previewUrl =
                    source === 'seedance'
                      ? resolveSeedanceMediaPreviewUrl(
                          asset,
                          isAudio ? 'audio' : isVideo ? 'video' : 'image'
                        )
                      : asset.previewUrl
                        ? isAudio
                          ? normalizeAudioUrl(asset.previewUrl)
                          : isVideo
                            ? normalizeVideoUrl(asset.previewUrl)
                            : normalizeImageUrl(asset.previewUrl)
                        : isAudio
                          ? normalizeAudioUrl(asset.url)
                          : source === 'local'
                            ? asset.url
                            : isVideo
                              ? normalizeVideoUrl(asset.url)
                              : normalizeImageUrl(asset.url);
                  const assetLabel = isVideo ? '视频资产' : isAudio ? '音频资产' : '图片资产';
                  return (
                    <button
                      key={asset.id || asset.url}
                      className={`asset-card ${selected ? 'selected' : ''}`}
                      onClick={() => onToggleAsset(asset)}
                      title={asset.name}
                    >
                      {isVideo ? (
                        <video src={previewUrl} muted playsInline preload="metadata" />
                      ) : isAudio && previewUrl ? (
                        <div className="asset-audio-preview asset-audio-preview-playable">
                          <audio src={previewUrl} controls preload="metadata" onClick={(e) => e.stopPropagation()} />
                        </div>
                      ) : isAudio ? (
                        <div className="asset-audio-preview">
                          <Headphones size={22} />
                        </div>
                      ) : (
                        <img src={previewUrl} alt={asset.name || assetLabel} />
                      )}
                      <span>{asset.name || assetLabel}</span>
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
