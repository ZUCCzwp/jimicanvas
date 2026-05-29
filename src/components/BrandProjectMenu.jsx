import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FolderKanban, Home, Plus, Trash2, Wand2 } from 'lucide-react';

export function BrandProjectMenu({
  siteTitle = 'JimiCanvas',
  siteLogoUrl = '',
  activeCanvasName = '',
  projectLoading = false,
  onRenameCanvas,
  onGoHome,
  onViewAllProjects,
  onCreateProject,
  onDeleteProject,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${rect.left}px`,
      minWidth: `${Math.max(rect.width, 196)}px`,
      zIndex: 10000,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }

    updateMenuPosition();

    const handleLayoutChange = () => updateMenuPosition();
    window.addEventListener('resize', handleLayoutChange);
    window.addEventListener('scroll', handleLayoutChange, true);
    return () => {
      window.removeEventListener('resize', handleLayoutChange);
      window.removeEventListener('scroll', handleLayoutChange, true);
    };
  }, [open, siteTitle]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown, true);
    }, 0);

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const runAction = (action) => {
    setOpen(false);
    action?.();
  };

  const dropdown =
    open && menuStyle
      ? createPortal(
          <div
            ref={dropdownRef}
            className="brand-project-dropdown"
            style={menuStyle}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="brand-project-dropdown-item"
              onClick={() => runAction(onGoHome)}
            >
              <Home size={16} aria-hidden="true" />
              <span>回到主页</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="brand-project-dropdown-item"
              onClick={() => runAction(onViewAllProjects)}
            >
              <FolderKanban size={16} aria-hidden="true" />
              <span>全部项目</span>
            </button>
            <div className="brand-project-dropdown-divider" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="brand-project-dropdown-item"
              onClick={() => runAction(onCreateProject)}
            >
              <Plus size={16} aria-hidden="true" />
              <span>创建新项目</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="brand-project-dropdown-item is-danger"
              onClick={() => runAction(onDeleteProject)}
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>删除项目</span>
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="brand-project-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`brand-project-trigger ${open ? 'is-open' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="项目菜单"
        title="项目菜单"
      >
        <span className={`brand-mark ${siteLogoUrl ? 'has-logo' : ''}`}>
          {siteLogoUrl ? (
            <img src={siteLogoUrl} alt="" className="brand-mark-logo" />
          ) : (
            <Wand2 size={18} />
          )}
        </span>
        <span className="brand-project-site-title">{siteTitle}</span>
        <ChevronDown size={16} className={`brand-project-chevron ${open ? 'is-open' : ''}`} />
      </button>

      <span className="topbar-divider" aria-hidden="true" />

      <input
        className={`canvas-name ${projectLoading ? 'is-loading' : ''}`}
        value={activeCanvasName}
        readOnly={projectLoading}
        disabled={projectLoading}
        onChange={(event) => onRenameCanvas?.(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        placeholder="未命名"
        aria-label="画布名称"
      />

      {dropdown}
    </div>
  );
}
