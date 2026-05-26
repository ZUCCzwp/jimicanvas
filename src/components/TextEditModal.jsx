import { useEffect, useRef } from 'react';
import { FileText, X } from 'lucide-react';
import { NoteContentStyleToolbar } from './NoteContentStyleToolbar';
import {
  getNoteContentStyleCss,
  patchNoteContentStyle,
} from '../lib/noteContentStyle';

const FIELD_META = {
  content: {
    title: '编辑结果',
    subtitle: '文本节点生成结果',
    placeholder: '编辑结果文字',
  },
  prompt: {
    title: '编辑输入',
    subtitle: '运行前的输入内容',
    placeholder: '输入文字',
  },
};

export function TextEditModal({ node, field, onUpdateNode, onClose }) {
  const textareaRef = useRef(null);
  const meta = FIELD_META[field] || FIELD_META.content;
  const value = field === 'prompt' ? node.prompt || '' : node.content || '';
  const isContentField = field === 'content';
  const contentStyleCss = isContentField ? getNoteContentStyleCss(node.contentStyle) : null;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const length = textarea.value.length;
    textarea.setSelectionRange(length, length);
  }, []);

  function handleChange(event) {
    const patch = field === 'prompt' ? { prompt: event.target.value } : { content: event.target.value };
    onUpdateNode(node.id, { ...patch, status: 'idle' });
  }

  function handleContentStyleChange(patch) {
    onUpdateNode(node.id, {
      contentStyle: patchNoteContentStyle(node.contentStyle, patch),
      status: 'idle',
    });
  }

  return (
    <div className="asset-modal-backdrop" onPointerDown={onClose}>
      <section className="text-edit-modal" onPointerDown={(event) => event.stopPropagation()}>
        <header className="asset-modal-header">
          <div className="asset-modal-title">
            <FileText size={18} />
            <div>
              <strong>{node.title || meta.title}</strong>
              <span>{meta.subtitle}</span>
            </div>
          </div>
          <button className="panel-icon" onClick={onClose} title="关闭" type="button">
            <X size={16} />
          </button>
        </header>

        {isContentField ? (
          <NoteContentStyleToolbar
            contentStyle={node.contentStyle}
            onChange={handleContentStyleChange}
          />
        ) : null}

        <div className="text-edit-modal-body">
          <textarea
            ref={textareaRef}
            className="text-edit-modal-input"
            value={value}
            onChange={handleChange}
            style={contentStyleCss || undefined}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder={meta.placeholder}
          />
        </div>

        <footer className="asset-modal-footer">
          <span>
            Esc 关闭 · 修改会实时保存
            {isContentField ? ' · 样式同步到节点输出框' : ''}
          </span>
          <button className="icon-button primary" onClick={onClose} type="button">
            完成
          </button>
        </footer>
      </section>
    </div>
  );
}
