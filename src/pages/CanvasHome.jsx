import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  User,
  Video,
} from 'lucide-react';
import { AuthModal } from '../components/AuthModal';
import { useTheme } from '../hooks/useTheme';
import { openCanvasEditor } from '../lib/appNavigation';
import { fetchCanvasDocuments, saveCanvasDocuments } from '../lib/canvasApi';
import {
  deleteDocument,
  documentsToProjects,
  duplicateDocument,
  parseRawDocuments,
  renameDocument,
} from '../lib/canvasDocuments';
import { getStoredChatToken } from '../lib/jimiaigoApi';
import { fetchSiteConfig, getDefaultSiteSettings } from '../lib/siteApi';
import { clearAuthToken, fetchUserInfo } from '../lib/userApi';

const RECENT_PROJECT_LIMIT = 6;

const COPY = {
  pageTitle: '无限画布',
  heroBadge: 'JimiCanvas 工作台',
  heroTitle: '在无限画布上串联你的 AI 创作流程',
  heroSubtitle:
    '自由排布图片、视频与文本节点，在同一画布内完成灵感整理、AI 生图与生视频，并自动同步到云端。',
  startCreateButton: '开始创作',
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

function formatProjectTime(timestamp) {
  if (!timestamp) return '未知时间';
  const date = new Date(timestamp);
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

  const run = (command) => {
    setOpen(false);
    onAction(command, project);
  };

  return (
    <div className="canvas-home-project-menu" ref={menuRef}>
      <button
        type="button"
        className="canvas-home-project-menu-trigger"
        aria-label="更多操作"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div className="canvas-home-project-menu-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => run('open')}>
            {COPY.actionOpen}
          </button>
          <button type="button" role="menuitem" onClick={() => run('rename')}>
            {COPY.actionRename}
          </button>
          <button type="button" role="menuitem" onClick={() => run('duplicate')}>
            {COPY.actionDuplicate}
          </button>
          <button type="button" role="menuitem" className="danger" onClick={() => run('delete')}>
            {COPY.actionDelete}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CanvasHome() {
  const { theme, toggleTheme } = useTheme();
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
  const [activeCanvasId, setActiveCanvasId] = useState('');
  const [allProjectsVisible, setAllProjectsVisible] = useState(false);
  const [notice, setNotice] = useState('');

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

  const applyCanvasPayload = useCallback((data) => {
    setCanvasVersion(Number(data?.version) || 0);
    setActiveCanvasId((data && data.active_canvas_id) || '');
    const docs = parseRawDocuments(data?.documents);
    setRawDocuments(docs);
    setProjects(documentsToProjects(docs));
  }, []);

  const fetchProjects = useCallback(async () => {
    const authToken = getStoredChatToken();
    if (!authToken) {
      setProjects([]);
      setRawDocuments([]);
      return;
    }
    setProjectsLoading(true);
    try {
      const data = await fetchCanvasDocuments(authToken);
      applyCanvasPayload(data);
    } catch {
      setRawDocuments([]);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [applyCanvasPayload]);

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
    } catch {
      clearAuthToken();
      setToken('');
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchSiteConfig().then(setSiteSettings);
  }, []);

  useEffect(() => {
    refreshAuth().then(() => {
      if (getStoredChatToken()) fetchProjects();
    });
  }, [fetchProjects, refreshAuth]);

  useEffect(() => {
    const onTokenChange = () => {
      refreshAuth().then(() => {
        if (getStoredChatToken()) fetchProjects();
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

  const persistDocuments = async ({ documents, nextActiveCanvasId, successMessage }) => {
    const authToken = getStoredChatToken();
    if (!authToken) {
      setAuthMode('login');
      setAuthOpen(true);
      return false;
    }
    setProjectsSaving(true);
    try {
      const data = await saveCanvasDocuments(authToken, {
        documents,
        activeCanvasId: nextActiveCanvasId != null ? nextActiveCanvasId : activeCanvasId,
        version: canvasVersion,
      });
      applyCanvasPayload(data);
      if (successMessage) showNotice(successMessage);
      return true;
    } catch (error) {
      if (error?.isConflict) {
        await fetchProjects();
      }
      showNotice(error.message || '保存失败');
      return false;
    } finally {
      setProjectsSaving(false);
    }
  };

  const handleStartCreate = () => {
    requireAuth(() => openCanvasEditor({ createNew: true }));
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

  const handleRenameProject = (project) => {
    const value = window.prompt(COPY.renamePrompt, project.name);
    if (value == null) return;
    const trimmed = value.trim();
    if (!trimmed) {
      showNotice(COPY.renameRequired);
      return;
    }
    const documents = renameDocument(rawDocuments, project.id, trimmed);
    persistDocuments({ documents, successMessage: COPY.renameSuccess });
  };

  const handleDuplicateProject = async (project) => {
    const source = rawDocuments.find((doc) => doc.id === project.id);
    if (!source) {
      showNotice(COPY.projectNotFound);
      return;
    }
    const duplicated = duplicateDocument(source);
    const documents = [duplicated, ...rawDocuments];
    await persistDocuments({
      documents,
      nextActiveCanvasId: duplicated.id,
      successMessage: COPY.duplicateSuccess,
    });
  };

  const handleDeleteProject = (project) => {
    const confirmed = window.confirm(
      COPY.deleteConfirmMessage.replace('{name}', project.name)
    );
    if (!confirmed) return;
    const { documents, activeCanvasId: nextActive } = deleteDocument(
      rawDocuments,
      activeCanvasId,
      project.id
    );
    persistDocuments({
      documents,
      nextActiveCanvasId: nextActive,
      successMessage: COPY.deleteSuccess,
    });
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
    <div className="canvas-home">
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
          {token ? (
            <>
              <div className="canvas-home-user">
                <User size={16} />
                <span>{user?.nickname || '已登录'}</span>
              </div>
              <button type="button" className="canvas-home-text-btn" onClick={handleLogout}>
                <LogOut size={16} />
                {COPY.logout}
              </button>
            </>
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
          <div className="canvas-home-hero-badge">
            <Sparkles size={14} />
            <span>{COPY.heroBadge}</span>
          </div>
          <h1>{COPY.heroTitle}</h1>
          <p>{COPY.heroSubtitle}</p>
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
                  <Plus size={36} />
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
                <button
                  key={project.id}
                  type="button"
                  className="canvas-home-project-card"
                  onClick={() => handleOpenProject(project)}
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
                </button>
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
                <button
                  key={project.id}
                  type="button"
                  className="canvas-home-all-project-row"
                  onClick={() => handleOpenProject(project)}
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
                </button>
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
    </div>
  );
}
