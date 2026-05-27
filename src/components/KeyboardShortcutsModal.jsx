import { Keyboard, X } from 'lucide-react';
import { KEYBOARD_SHORTCUT_GROUPS } from '../lib/keyboardShortcuts';

export function KeyboardShortcutsModal({ onClose }) {
  return (
    <div className="asset-modal-backdrop" onPointerDown={onClose}>
      <div
        className="keyboard-shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="asset-modal-header keyboard-shortcuts-header">
          <div className="asset-modal-title">
            <Keyboard size={18} aria-hidden="true" />
            <div>
              <strong id="keyboard-shortcuts-title">键盘快捷键</strong>
              <span>在画布空白处或选中节点/连线时可用</span>
            </div>
          </div>
          <button type="button" className="icon-mini" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="keyboard-shortcuts-body">
          {KEYBOARD_SHORTCUT_GROUPS.map((group) => (
            <section key={group.id} className="keyboard-shortcuts-group">
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <span className="keyboard-shortcuts-desc">{item.description}</span>
                    <span className="keyboard-shortcuts-keys">
                      {item.keys.map((key, index) => (
                        <span key={`${item.id}-${index}`}>
                          {index > 0 ? <span className="keyboard-shortcuts-plus">+</span> : null}
                          <kbd>{key}</kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="keyboard-shortcuts-footer">
          <span>按 <kbd>?</kbd> 可随时打开此面板</span>
        </footer>
      </div>
    </div>
  );
}
