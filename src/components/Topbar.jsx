import {
  AlertCircle,
  Check,
  Cloud,
  CloudOff,
  CloudUpload,
  Keyboard,
  Loader2,
  MessageCircle,
  Moon,
  Sun,
  Wallet,
} from 'lucide-react';
import { BrandProjectMenu } from './BrandProjectMenu';
import { formatBalanceAmount } from '../lib/userApi';

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
    hint: '请检查网络后刷新重试',
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
  projectLoading = false,
  siteTitle,
  siteLogoUrl,
  nodesCount,
  connectionsCount,
  onRenameCanvas,
  onGoHome,
  onViewAllProjects,
  onCreateProject,
  onDeleteProject,
  onOpenKeyboardShortcuts,
  onOpenCustomerService,
  theme = 'dark',
  onToggleTheme,
  cloudSyncStatus = 'offline',
  cloudLastSyncedAt = null,
  quotaVisible = false,
  quotaLoading = false,
  quotaRemaining = null,
  quotaPercentage = null,
  onRecharge,
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
        <BrandProjectMenu
          siteTitle={siteTitle}
          siteLogoUrl={siteLogoUrl}
          activeCanvasName={projectLoading ? '同步中…' : activeCanvas?.name || ''}
          projectLoading={projectLoading}
          onRenameCanvas={onRenameCanvas}
          onGoHome={onGoHome}
          onViewAllProjects={onViewAllProjects}
          onCreateProject={onCreateProject}
          onDeleteProject={onDeleteProject}
        />

        <span className="meta-pill">{nodesCount} 节点</span>
        <span className="meta-pill">{connectionsCount} 连线</span>
      </div>

      <div className="topbar-meta">
        <div className="toolbar-row">
          {quotaVisible ? (
            <span
              className={`quota-chip ${
                quotaPercentage != null && quotaPercentage <= 5
                  ? 'quota-chip-critical'
                  : quotaPercentage != null && quotaPercentage <= 20
                    ? 'quota-chip-low'
                    : ''
              }`}
              title={
                quotaLoading
                  ? '正在加载个人额度'
                  : quotaPercentage != null
                    ? `剩余额度 ${quotaPercentage}%（${formatBalanceAmount(quotaRemaining ?? 0)}）`
                    : `剩余额度 ${formatBalanceAmount(quotaRemaining ?? 0)}`
              }
            >
              {quotaLoading ? (
                <Loader2 size={14} aria-hidden="true" className="sync-chip-spin" />
              ) : (
                <Wallet size={14} aria-hidden="true" />
              )}
              <span className="quota-chip-label">
                {quotaLoading ? '额度加载中' : formatBalanceAmount(quotaRemaining ?? 0)}
              </span>
              {!quotaLoading && quotaPercentage != null ? (
                <span className="quota-chip-hint">{quotaPercentage}%</span>
              ) : null}
            </span>
          ) : null}

          {onRecharge ? (
            <button
              type="button"
              className="topbar-shortcuts-button topbar-recharge-button"
              onClick={onRecharge}
              title="前往充值"
              aria-label="充值"
            >
              <Wallet size={14} aria-hidden="true" />
              <span>充值</span>
            </button>
          ) : null}

          <button
            type="button"
            className="topbar-shortcuts-button"
            onClick={onOpenCustomerService}
            title="联系客服"
            aria-label="联系客服"
          >
            <MessageCircle size={14} aria-hidden="true" />
            <span>联系客服</span>
          </button>

          <button
            type="button"
            className="topbar-shortcuts-button"
            onClick={onOpenKeyboardShortcuts}
            title="键盘快捷键 (?)"
            aria-label="键盘快捷键"
          >
            <Keyboard size={14} aria-hidden="true" />
            <span>快捷键</span>
          </button>

          {onToggleTheme ? (
            <button
              type="button"
              className={`topbar-shortcuts-button topbar-theme-button ${theme === 'light' ? 'is-active' : ''}`}
              onClick={onToggleTheme}
              title={theme === 'dark' ? '切换浅色主题' : '切换深色主题'}
              aria-label={theme === 'dark' ? '切换浅色主题' : '切换深色主题'}
            >
              {theme === 'dark' ? (
                <Sun size={14} aria-hidden="true" />
              ) : (
                <Moon size={14} aria-hidden="true" />
              )}
              <span>{theme === 'dark' ? '浅色' : '深色'}</span>
            </button>
          ) : null}

          <span
            className={`sync-chip ${cloudMeta.className}`}
            title={syncedHint || cloudMeta.label}
          >
            <CloudIcon size={14} aria-hidden="true" className={cloudMeta.spin ? 'sync-chip-spin' : ''} />
            <span>{cloudMeta.label}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
