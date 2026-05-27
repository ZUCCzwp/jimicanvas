import {
  AlertCircle,
  Check,
  Cloud,
  CloudOff,
  CloudUpload,
  Keyboard,
  Loader2,
  MessageCircle,
  Wand2,
} from 'lucide-react';

const CLOUD_SYNC_META = {
  offline: {
    label: '云端未登录',
    hint: '配置 Token 后可跨设备同步',
    className: 'sync-chip-offline',
    Icon: CloudOff,
    spin: false,
  },
  loading: {
    label: '云端加载中',
    hint: '正在拉取云端画布…',
    className: 'sync-chip-loading',
    Icon: Loader2,
    spin: true,
  },
  pending: {
    label: '待同步云端',
    hint: '编辑停止后将自动上传',
    className: 'sync-chip-pending',
    Icon: CloudUpload,
    spin: false,
  },
  saving: {
    label: '正在上传',
    hint: '正在保存到云端…',
    className: 'sync-chip-saving',
    Icon: Loader2,
    spin: true,
  },
  synced: {
    label: '云端已同步',
    hint: '',
    className: 'sync-chip-synced',
    Icon: Check,
    spin: false,
  },
  error: {
    label: '云端同步失败',
    hint: '将继续使用本地缓存，稍后自动重试',
    className: 'sync-chip-error',
    Icon: AlertCircle,
    spin: false,
  },
};

function formatSyncedAt(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  if (diff < 10_000) return '刚刚';
  if (diff < 60_000) return `${Math.floor(diff / 1000)} 秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

export function Topbar({
  activeCanvas,
  siteTitle,
  siteSlogan,
  siteLogoUrl,
  nodesCount,
  connectionsCount,
  showCanvasPanel = false,
  onRenameCanvas,
  onToggleCanvasPanel,
  onOpenKeyboardShortcuts,
  onOpenCustomerService,
  cloudSyncStatus = 'offline',
  cloudLastSyncedAt = null,
}) {
  const cloudMeta = CLOUD_SYNC_META[cloudSyncStatus] || CLOUD_SYNC_META.offline;
  const CloudIcon = cloudMeta.Icon;
  const syncedHint =
    cloudSyncStatus === 'synced' && cloudLastSyncedAt
      ? `${formatSyncedAt(cloudLastSyncedAt)}同步`
      : cloudMeta.hint;

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <button
          type="button"
          className={`brand-mark-button ${showCanvasPanel ? 'active' : ''}`}
          onClick={onToggleCanvasPanel}
          title="画布管理：新增、切换、删除画布"
          aria-label="画布管理"
          aria-expanded={showCanvasPanel}
        >
          <span className={`brand-mark ${siteLogoUrl ? 'has-logo' : ''}`}>
            {siteLogoUrl ? (
              <img src={siteLogoUrl} alt={siteTitle || '网站 Logo'} className="brand-mark-logo" />
            ) : (
              <Wand2 size={18} />
            )}
          </span>
        </button>

        <div className="brand-copy">
          <strong>{siteTitle}</strong>
          {siteSlogan ? <span>{siteSlogan}</span> : null}
        </div>

        <span className="topbar-divider" aria-hidden="true" />

        <input
          className="canvas-name"
          value={activeCanvas?.name || ''}
          onChange={(event) => onRenameCanvas(event.target.value)}
          placeholder="画布名称"
          aria-label="画布名称"
        />

        <span className="meta-pill">{nodesCount} 节点</span>
        <span className="meta-pill">{connectionsCount} 连线</span>
      </div>

      <div className="topbar-meta">
        <div className="toolbar-row">
          <button
            type="button"
            className="topbar-shortcuts-button"
            onClick={onOpenCustomerService}
            title="联系客服"
            aria-label="联系客服"
          >
            <MessageCircle size={15} aria-hidden="true" />
            <span>联系客服</span>
          </button>

          <button
            type="button"
            className="topbar-shortcuts-button"
            onClick={onOpenKeyboardShortcuts}
            title="键盘快捷键 (?)"
            aria-label="键盘快捷键"
          >
            <Keyboard size={15} aria-hidden="true" />
            <span>快捷键</span>
            <kbd>?</kbd>
          </button>

          <span
            className={`sync-chip ${cloudMeta.className}`}
            title={syncedHint || cloudMeta.label}
          >
            {cloudSyncStatus === 'synced' ? (
              <Cloud size={14} aria-hidden="true" />
            ) : (
              <CloudIcon
                size={14}
                aria-hidden="true"
                className={cloudMeta.spin ? 'sync-chip-spin' : undefined}
              />
            )}
            <span className="sync-chip-label">{cloudMeta.label}</span>
            {syncedHint ? <span className="sync-chip-hint">{syncedHint}</span> : null}
          </span>
        </div>
      </div>
    </header>
  );
}
