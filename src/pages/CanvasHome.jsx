import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Crown,
  CloudUpload,
  Grid3x3,
  Image,
  Loader2,
  LogOut,
  Maximize2,
  Moon,
  MoreHorizontal,
  Plus,
  Sparkles,
  Sun,
  Video,
  Wallet,
  Workflow,
} from 'lucide-react';
import { AnimatedCharacters } from '../components/AnimatedCharacters';
import { AuthModal } from '../components/AuthModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RechargeModal } from '../components/RechargeModal';
import { WorkflowTemplateModal } from '../components/WorkflowTemplateModal';
import { CanvasHomeBackground } from '../components/CanvasHomeBackground';
import { useHomeEntranceAnimation } from '../hooks/useHomeEntranceAnimation';
import { useTheme } from '../hooks/useTheme';
import { openCanvasEditor } from '../lib/appNavigation';
import {
  deleteCanvasDocument,
  fetchCanvasDocument,
  fetchCanvasList,
  saveCanvasDocument,
} from '../lib/canvasApi';
import {
  documentsToProjects,
  duplicateDocument,
  parseRawDocuments,
  renameDocument,
} from '../lib/canvasDocuments';
import { getStoredChatToken, isBackendInCooldown } from '../lib/jimiaigoApi';
import { fetchSiteConfig, getDefaultSiteSettings } from '../lib/siteApi';
import {
  clearAuthToken,
  fetchUserInfo,
  formatBalanceAmount,
  getUserDisplayInitial,
} from '../lib/userApi';

const RECENT_PROJECT_LIMIT = 6;

const COPY = {
  pageTitle: '无限画布',
  heroBadge: 'JimiCanvas 工作台',
  heroTitle: '在无限画布上串联你的 AI 创作流程',
  heroSubtitle:
    '自由排布图片、视频与文本节点，在同一画布内完成灵感整理、AI 生图与生视频，并自动同步到云端。',
  startCreateButton: '开始创作',
  workflowTemplatesButton: '预设工作流模版',
  workflowTemplatesDesc: '文生图、图生视频、图片/视频反推提示词等常用流程',
  createCardDesc: '新建空白画布，开启新的创作',
  createCardAction: '立即创建',
  recentProjectsTitle: '最近项目',
  viewAllProjects: '查看全部项目',
  allProjectsTitle: '全部画布项目',
  emptyProjects: '还没有画布项目，点击开始创作创建第一个',
  openProject: '打开',
  actionOpen: '打开',
  actionRename: '重命名',
  actionDuplicate: '复制',
  actionDelete: '删除',
  renameTitle: '重命名项目',
  renamePrompt: '请输入新的项目名称',
  renameRequired: '名称不能为空',
  renameSuccess: '重命名成功',
  duplicateSuccess: '复制成功',
  deleteSuccess: '删除成功',
  deleteConfirmTitle: '删除项目',
  deleteConfirmMessage: '确定删除「{name}」吗？此操作不可恢复。',
  projectNotFound: '项目不存在，请刷新后重试',
  confirm: '确定',
  cancel: '取消',
  closeDialog: '关闭',
  featuresTitle: '核心能力',
  login: '登录',
  logout: '退出登录',
  features: {
    infinite: {
      title: '无限画布',
      desc: '自由缩放与平移，节点随意摆放，适合分镜、素材墙与多方案对比。',
    },
    aiImage: {
      title: 'AI 生图',
      desc: '在画布节点内直接调用生图模型，结果即时落到节点上。',
    },
    aiVideo: {
      title: 'AI 生视频',
      desc: '支持 Sora、VEO 等多线路视频生成，与图片节点协同编排。',
    },
    cloud: {
      title: '云端同步',
      desc: '画布内容自动保存到云端，换设备也能继续创作。',
    },
  },
};

/** 统一为毫秒：云端列表为 Unix 秒，画布 JSON 内 updatedAt 为毫秒 */
function toTimestampMillis(timestamp) {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

function formatProjectTime(timestamp) {
  const ms = toTimestampMillis(timestamp);
  if (!ms) return '未知时间';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '未知时间';

  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < day * 7) return `${Math.floor(diff / day)} 天前`;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function CanvasHomeUserAvatar({ user, className = '' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = user?.avatarUrl;
  const initial = getUserDisplayInitial(user?.nickname);
  const classNames = ['canvas-home-user-avatar', className].filter(Boolean).join(' ');

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !imageFailed) {
    return (
      <span className={classNames} aria-hidden="true">
        <img
          src={avatarUrl}
          alt=""
          className="canvas-home-user-avatar-img"
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  return (
    <span className={classNames} aria-hidden="true">
      <span className="canvas-home-user-avatar-fallback">{initial}</span>
    </span>
  );
}

function CanvasHomeUserMenu({ user, onRecharge, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const nickname = user?.nickname || '已登录';
  const balanceLabel = formatBalanceAmount(user?.remaining);
  const isVip = Boolean(user?.isVip);
  const memberLabel = isVip ? 'VIP 会员' : '普通用户';

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const run = (action) => {
    setOpen(false);
    action?.();
  };

  return (
    <div className={`canvas-home-user-menu${open ? ' is-open' : ''}`} ref={menuRef}>
      <button
        type="button"
        className="canvas-home-user-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={`canvas-home-user-avatar-wrap${isVip ? ' is-vip' : ''}`}>
          <CanvasHomeUserAvatar user={user} />
          {isVip ? (
            <span className="canvas-home-vip-badge" title="VIP 会员">
              <Crown size={10} strokeWidth={2.5} aria-hidden="true" />
            </span>
          ) : null}
        </span>
        <span className="canvas-home-user-name">{nickname}</span>
        <ChevronDown size={16} className="canvas-home-user-chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div className="canvas-home-user-dropdown" role="menu">
          <div className="canvas-home-user-dropdown-head">
            <span className={`canvas-home-user-avatar-wrap is-dropdown${isVip ? ' is-vip' : ''}`}>
              <CanvasHomeUserAvatar user={user} className="is-dropdown" />
              {isVip ? (
                <span className="canvas-home-vip-badge is-dropdown" title="VIP 会员">
                  <Crown size={11} strokeWidth={2.5} aria-hidden="true" />
                </span>
              ) : null}
            </span>
            <div className="canvas-home-user-dropdown-meta">
              <div className="canvas-home-user-dropdown-title-row">
                <strong>{nickname}</strong>
                <span className={`canvas-home-member-badge${isVip ? ' is-vip' : ''}`}>{memberLabel}</span>
              </div>
              <span>可用余额 {balanceLabel}</span>
            </div>
          </div>
          <button type="button" role="menuitem" className="canvas-home-user-dropdown-item" onClick={() => run(onRecharge)}>
            <Wallet size={16} aria-hidden="true" />
            <span>充值</span>
          </button>
          <div className="canvas-home-user-dropdown-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="canvas-home-user-dropdown-item is-danger"
            onClick={() => run(onLogout)}
          >
            <LogOut size={16} aria-hidden="true" />
            <span>{COPY.logout}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProjectMenu({ project, onAction }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [open]);

  const run = (command, event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    setOpen(false);
    onAction(command, project);
  };

  const stopMenuEvent = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      className="canvas-home-project-menu"
      ref={menuRef}
      onPointerDown={stopMenuEvent}
      onClick={stopMenuEvent}
    >
      <button
        type="button"
        className="canvas-home-project-menu-trigger"
        aria-label="更多操作"
        aria-expanded={open}
        onPointerDown={stopMenuEvent}
        onClick={(event) => {
          stopMenuEvent(event);
          setOpen((prev) => !prev);
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div
          className="canvas-home-project-menu-dropdown"
          role="menu"
          onPointerDown={stopMenuEvent}
          onClick={stopMenuEvent}
        >
          <button type="button" role="menuitem" onClick={(event) => run('open', event)}>
            {COPY.actionOpen}
          </button>
          <button type="button" role="menuitem" onClick={(event) => run('rename', event)}>
            {COPY.actionRename}
          </button>
          <button type="button" role="menuitem" onClick={(event) => run('duplicate', event)}>
            {COPY.actionDuplicate}
          </button>
          <button type="button" role="menuitem" className="danger" onClick={(event) => run('delete', event)}>
            {COPY.actionDelete}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function openProjectFromCard(event, project, onOpen) {
  if (event.target.closest('.canvas-home-project-menu')) return;
  onOpen(project);
}

export function CanvasHome() {
  const { theme, toggleTheme } = useTheme();
  const homeRef = useHomeEntranceAnimation();
  const [siteSettings, setSiteSettings] = useState(getDefaultSiteSettings);
  const [token, setToken] = useState(() => getStoredChatToken());
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(() => !getStoredChatToken());
  const [authMode, setAuthMode] = useState('login');
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsSaving, setProjectsSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [rawDocuments, setRawDocuments] = useState([]);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [canvasVersions, setCanvasVersions] = useState({});
  const [activeCanvasId, setActiveCanvasId] = useState('');
  const [allProjectsVisible, setAllProjectsVisible] = useState(false);
  const [notice, setNotice] = useState('');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [workflowTemplateOpen, setWorkflowTemplateOpen] = useState(false);

  const recentProjects = useMemo(
    () => projects.slice(0, RECENT_PROJECT_LIMIT),
    [projects]
  );

  const features = useMemo(
    () => [
      { key: 'infinite', icon: Maximize2, iconClass: 'icon-infinite', ...COPY.features.infinite },
      { key: 'ai-image', icon: Image, iconClass: 'icon-image', ...COPY.features.aiImage },
      { key: 'ai-video', icon: Video, iconClass: 'icon-video', ...COPY.features.aiVideo },
      { key: 'cloud', icon: CloudUpload, iconClass: 'icon-cloud', ...COPY.features.cloud },
    ],
    []
  );

  const showNotice = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2800);
  }, []);

  const applyListPayload = useCallback((data) => {
    setCanvasVersion(Number(data?.version) || 0);
    setActiveCanvasId((data && data.active_canvas_id) || '');
    const summaries = Array.isArray(data?.canvases) ? data.canvases : [];
    const docs = summaries.map((item) => ({
      id: item.id,
      name: item.name,
      nodes: [],
      connections: [],
      updatedAt: toTimestampMillis(item.updated_at) || Date.now(),
    }));
    setRawDocuments(docs);
    setProjects(documentsToProjects(docs));
    const versions = {};
    summaries.forEach((item) => {
      if (item.id) versions[item.id] = Number(item.version) || 0;
    });
    setCanvasVersions(versions);
  }, []);

  const applyFullPayload = useCallback((data) => {
    setCanvasVersion(Number(data?.version) || 0);
    setActiveCanvasId((data && data.active_canvas_id) || '');
    const docs = parseRawDocuments(data?.documents);
    setRawDocuments(docs);
    setProjects(documentsToProjects(docs));
    if (data?.canvas_versions) {
      setCanvasVersions((prev) => ({ ...prev, ...data.canvas_versions }));
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    const authToken = getStoredChatToken();
    if (!authToken) {
      setProjects([]);
      setRawDocuments([]);
      return;
    }
    if (isBackendInCooldown()) return;

    setProjectsLoading(true);
    try {
      const data = await fetchCanvasList(authToken);
      applyListPayload(data);
    } catch {
      setRawDocuments([]);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [applyListPayload]);

  const refreshAuth = useCallback(async () => {
    const authToken = getStoredChatToken();
    setToken(authToken);
    if (!authToken) {
      setUser(null);
      return;
    }
    try {
      const info = await fetchUserInfo(authToken);
      setUser(info);
    } catch (error) {
      if (error?.isTokenExpired) {
        clearAuthToken();
        setToken('');
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchSiteConfig().then(setSiteSettings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshAuth().then(() => {
      if (!cancelled && getStoredChatToken() && !isBackendInCooldown()) fetchProjects();
    });
    return () => {
      cancelled = true;
    };
  }, [fetchProjects, refreshAuth]);

  useEffect(() => {
    const onTokenChange = () => {
      if (isBackendInCooldown()) return;
      refreshAuth().then(() => {
        if (getStoredChatToken() && !isBackendInCooldown()) fetchProjects();
      });
    };
    window.addEventListener('auth:token-saved', onTokenChange);
    window.addEventListener('auth:token-cleared', onTokenChange);
    return () => {
      window.removeEventListener('auth:token-saved', onTokenChange);
      window.removeEventListener('auth:token-cleared', onTokenChange);
    };
  }, [fetchProjects, refreshAuth]);

  const requireAuth = useCallback(
    (action) => {
      if (getStoredChatToken()) {
        action();
        return;
      }
      setAuthMode('login');
      setAuthOpen(true);
    },
    []
  );

  const openRechargeModal = useCallback(() => {
    const authToken = getStoredChatToken();
    if (!authToken) {
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }
    setShowRechargeModal(true);
  }, []);

  const handleRechargeSuccess = useCallback(() => {
    refreshAuth();
  }, [refreshAuth]);

  const handleStartCreate = () => {
    requireAuth(() => openCanvasEditor({ createNew: true }));
  };

  const handleOpenWorkflowTemplates = () => {
    requireAuth(() => setWorkflowTemplateOpen(true));
  };

  const handleSelectWorkflowTemplate = (templateId) => {
    setWorkflowTemplateOpen(false);
    requireAuth(() => openCanvasEditor({ createNew: true, templateId }));
  };

  const handleOpenProject = (project) => {
    if (!project?.id) return;
    setAllProjectsVisible(false);
    requireAuth(() => openCanvasEditor({ canvasId: project.id }));
  };

  const handleProjectAction = (command, project) => {
    if (!project) return;
    switch (command) {
      case 'open':
        handleOpenProject(project);
        break;
      case 'rename':
        requireAuth(() => handleRenameProject(project));
        break;
      case 'duplicate':
        requireAuth(() => handleDuplicateProject(project));
        break;
      case 'delete':
        requireAuth(() => handleDeleteProject(project));
        break;
      default:
        break;
    }
  };

  const handleRenameProject = async (project) => {
    const value = window.prompt(COPY.renamePrompt, project.name);
    if (value == null) return;
    const trimmed = value.trim();
    if (!trimmed) {
      showNotice(COPY.renameRequired);
      return;
    }
    const authToken = getStoredChatToken();
    if (!authToken) {
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }
    setProjectsSaving(true);
    try {
      const cloud = await fetchCanvasDocument(authToken, project.id);
      const docs = parseRawDocuments(cloud?.documents);
      const source = docs.find((doc) => doc.id === project.id);
      if (!source) {
        showNotice(COPY.projectNotFound);
        return;
      }
      const renamed = renameDocument([source], project.id, trimmed)[0];
      const data = await saveCanvasDocument(authToken, project.id, {
        document: renamed,
        version: canvasVersions[project.id] || 0,
        activeCanvasId,
      });
      applyFullPayload(data);
      showNotice(COPY.renameSuccess);
    } catch (error) {
      if (error?.isConflict) await fetchProjects();
      showNotice(error.message || '保存失败');
    } finally {
      setProjectsSaving(false);
    }
  };

  const handleDuplicateProject = async (project) => {
    const authToken = getStoredChatToken();
    if (!authToken) {
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }
    setProjectsSaving(true);
    try {
      const cloud = await fetchCanvasDocument(authToken, project.id);
      const docs = parseRawDocuments(cloud?.documents);
      const source = docs.find((doc) => doc.id === project.id);
      if (!source) {
        showNotice(COPY.projectNotFound);
        return;
      }
      const duplicated = duplicateDocument(source);
      const data = await saveCanvasDocument(authToken, duplicated.id, {
        document: duplicated,
        version: 0,
        activeCanvasId: duplicated.id,
      });
      applyFullPayload(data);
      showNotice(COPY.duplicateSuccess);
    } catch (error) {
      if (error?.isConflict) await fetchProjects();
      showNotice(error.message || '保存失败');
    } finally {
      setProjectsSaving(false);
    }
  };

  const handleDeleteProject = (project) => {
    if (!project?.id) return;
    setDeleteTarget(project);
  };

  const handleConfirmDeleteProject = async () => {
    if (!deleteTarget?.id || deleteLoading) return;
    const authToken = getStoredChatToken();
    if (!authToken) {
      setDeleteTarget(null);
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }
    setDeleteLoading(true);
    try {
      const data = await deleteCanvasDocument(authToken, deleteTarget.id);
      applyFullPayload(data);
      setDeleteTarget(null);
      showNotice(COPY.deleteSuccess);
    } catch (error) {
      showNotice(error.message || '删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setAuthOpen(false);
    refreshAuth().then(() => fetchProjects());
  };

  const handleLogout = () => {
    clearAuthToken();
    setToken('');
    setUser(null);
    setProjects([]);
    setRawDocuments([]);
    setAuthMode('login');
    setAuthOpen(true);
  };

  return (
    <div className="canvas-home" ref={homeRef}>
      <CanvasHomeBackground />
      {notice ? <div className="canvas-home-notice">{notice}</div> : null}

      <header className="canvas-home-topbar">
        <div className="canvas-home-brand">
          {siteSettings.logoUrl ? (
            <img src={siteSettings.logoUrl} alt="" className="canvas-home-logo" />
          ) : (
            <Sparkles size={20} />
          )}
          <div>
            <strong>{siteSettings.title || COPY.pageTitle}</strong>
            <span>{siteSettings.slogan}</span>
          </div>
        </div>
        <div className="canvas-home-topbar-actions">
          <button type="button" className="canvas-home-icon-btn" onClick={toggleTheme} aria-label="切换主题">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button
            type="button"
            className="canvas-home-recharge-btn"
            onClick={openRechargeModal}
            title="充值"
            aria-label="充值"
          >
            <span className="canvas-home-recharge-btn-icon" aria-hidden="true">
              <Wallet size={15} strokeWidth={2.25} />
            </span>
            <span className="canvas-home-recharge-btn-label">充值</span>
          </button>
          <span className="canvas-home-topbar-divider" aria-hidden="true" />
          {token ? (
            <CanvasHomeUserMenu
              user={user}
              onRecharge={openRechargeModal}
              onLogout={handleLogout}
            />
          ) : (
            <button
              type="button"
              className="canvas-home-primary-btn"
              onClick={() => {
                setAuthMode('login');
                setAuthOpen(true);
              }}
            >
              {COPY.login}
            </button>
          )}
        </div>
      </header>

      <main className="canvas-home-main">
        <section className="canvas-home-hero">
          <div className="canvas-home-hero-glow" aria-hidden="true" />
          <div className="canvas-home-hero-shimmer" aria-hidden="true" />
          <div className="canvas-home-hero-inner">
            <div className="canvas-home-hero-content">
              <div className="canvas-home-hero-badge">
                <Sparkles size={14} />
                <span>{COPY.heroBadge}</span>
              </div>
              <h1>{COPY.heroTitle}</h1>
              <p className="canvas-home-hero-subtitle">{COPY.heroSubtitle}</p>
              <div className="canvas-home-hero-actions">
                <button type="button" className="canvas-home-hero-cta" onClick={handleStartCreate}>
                  <Sparkles size={16} />
                  {COPY.startCreateButton}
                </button>
              </div>
            </div>
            <div className="canvas-home-hero-visual">
              <AnimatedCharacters />
            </div>
          </div>
        </section>

        <section className="canvas-home-projects">
          <div className="canvas-home-section-header">
            <h2>{COPY.recentProjectsTitle}</h2>
            {projects.length > 0 ? (
              <button type="button" className="canvas-home-link-btn" onClick={() => setAllProjectsVisible(true)}>
                {COPY.viewAllProjects}
              </button>
            ) : null}
          </div>

          <div className={`canvas-home-projects-body${projectsLoading || projectsSaving ? ' is-loading' : ''}`}>
            {(projectsLoading || projectsSaving) && (
              <div className="canvas-home-loading">
                <Loader2 size={24} className="spin" />
              </div>
            )}
            <div className="canvas-home-projects-grid">
              <button type="button" className="canvas-home-project-card create-card" onClick={handleStartCreate}>
                <div className="canvas-home-project-cover create-cover">
                  <Plus size={32} />
                </div>
                <div className="canvas-home-project-body">
                  <h3>{COPY.startCreateButton}</h3>
                  <p>{COPY.createCardDesc}</p>
                </div>
                <div className="canvas-home-project-action">
                  <span>{COPY.createCardAction}</span>
                </div>
              </button>

              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  className="canvas-home-project-card"
                  onClick={(event) => openProjectFromCard(event, project, handleOpenProject)}
                  onKeyDown={(event) => {
                    if (event.target.closest('.canvas-home-project-menu')) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleOpenProject(project);
                    }
                  }}
                >
                  <ProjectMenu project={project} onAction={handleProjectAction} />
                  <div className="canvas-home-project-cover">
                    <Grid3x3 size={32} />
                  </div>
                  <div className="canvas-home-project-body">
                    <h3 title={project.name}>{project.name}</h3>
                    <p>
                      {project.nodeCount} 个节点 · {formatProjectTime(project.updatedAt)}
                    </p>
                  </div>
                  <div className="canvas-home-project-action">
                    <span>{COPY.openProject}</span>
                  </div>
                </div>
              ))}
            </div>

            {!projectsLoading && token && recentProjects.length === 0 ? (
              <p className="canvas-home-empty-hint">{COPY.emptyProjects}</p>
            ) : null}
          </div>
        </section>

        <section className="canvas-home-features">
          <h2>{COPY.featuresTitle}</h2>
          <div className="canvas-home-features-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.key} className="canvas-home-feature-card">
                  <div className={`canvas-home-feature-icon ${feature.iconClass}`}>
                    <Icon size={20} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {allProjectsVisible ? (
        <div className="asset-modal-backdrop" onPointerDown={() => setAllProjectsVisible(false)}>
          <div
            className="canvas-home-all-projects-dialog"
            role="dialog"
            aria-modal="true"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className="canvas-home-dialog-header">
              <h3>{COPY.allProjectsTitle}</h3>
              <button type="button" className="icon-mini" onClick={() => setAllProjectsVisible(false)}>
                ×
              </button>
            </header>
            <div className={`canvas-home-all-projects-list${projectsLoading || projectsSaving ? ' is-loading' : ''}`}>
              {!projectsLoading && projects.length === 0 ? (
                <p className="canvas-home-empty-hint">{COPY.emptyProjects}</p>
              ) : null}
              {projects.map((project) => (
                <div
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  className="canvas-home-all-project-row"
                  onClick={(event) => openProjectFromCard(event, project, handleOpenProject)}
                  onKeyDown={(event) => {
                    if (event.target.closest('.canvas-home-project-menu')) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleOpenProject(project);
                    }
                  }}
                >
                  <div className="canvas-home-all-project-icon">
                    <Grid3x3 size={18} />
                  </div>
                  <div className="canvas-home-all-project-info">
                    <div>{project.name}</div>
                    <span>
                      {project.nodeCount} 个节点 · {formatProjectTime(project.updatedAt)}
                    </span>
                  </div>
                  <ProjectMenu project={project} onAction={handleProjectAction} />
                </div>
              ))}
            </div>
            <footer className="canvas-home-dialog-footer">
              <button type="button" onClick={() => setAllProjectsVisible(false)}>
                {COPY.closeDialog}
              </button>
              <button type="button" className="primary" onClick={() => {
                setAllProjectsVisible(false);
                handleStartCreate();
              }}>
                {COPY.startCreateButton}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <AuthModal
        isOpen={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        siteTitle={siteSettings.title || COPY.pageTitle}
        siteSlogan={siteSettings.slogan}
        logoUrl={siteSettings.logoUrl}
      />

      {showRechargeModal ? (
        <RechargeModal
          isOpen={showRechargeModal}
          user={user}
          onClose={() => setShowRechargeModal(false)}
          onSuccess={handleRechargeSuccess}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={COPY.deleteConfirmTitle}
        message={
          deleteTarget
            ? COPY.deleteConfirmMessage.replace('{name}', deleteTarget.name)
            : ''
        }
        confirmLabel={COPY.actionDelete}
        cancelLabel={COPY.cancel}
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => {
          if (!deleteLoading) setDeleteTarget(null);
        }}
      />

      <WorkflowTemplateModal
        isOpen={workflowTemplateOpen}
        onClose={() => setWorkflowTemplateOpen(false)}
        onSelect={handleSelectWorkflowTemplate}
      />
    </div>
  );
}
