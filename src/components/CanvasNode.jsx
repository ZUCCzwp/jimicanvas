import {
  Bot,
  FileText,
  Film,
  Image as ImageIcon,
  Languages,
  LoaderCircle,
  Play,
  Trash2,
} from 'lucide-react';
import { DEFAULT_TEXT_MODEL } from '../lib/constants';
import { isImageContent, isVideoContent } from '../lib/canvas';

function NodeIcon({ type }) {
  if (type === 'image') return <ImageIcon size={14} />;
  if (type === 'video') return <Film size={14} />;
  return <FileText size={14} />;
}

function NoteBody({
  node,
  isEditing,
  isRunning,
  onBeginDrag,
  onEdit,
  onUpdateNode,
  onStopEditing,
}) {
  if (isRunning) {
    return (
      <div className="node-run-state">
        <LoaderCircle size={22} className="spin-icon" />
        <span>正在运行</span>
      </div>
    );
  }

  if (node.status === 'error' && !isEditing) {
    return (
      <div
        className="node-error-display"
        onPointerDown={(event) => onBeginDrag(event, node)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onEdit(node.id);
        }}
      >
        <strong>运行失败</strong>
        <span>{node.content || '生成失败'}</span>
      </div>
    );
  }

  if (isEditing) {
    return (
      <textarea
        autoFocus
        value={node.content}
        onChange={(event) => onUpdateNode(node.id, { content: event.target.value, status: 'idle' })}
        onBlur={onStopEditing}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onStopEditing();
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        placeholder="编辑结果文字"
      />
    );
  }

  return (
    <div
      className="node-text-display"
      onPointerDown={(event) => onBeginDrag(event, node)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEdit(node.id);
      }}
    >
      {node.content || '暂无结果'}
    </div>
  );
}

function MediaBody({ node, onUpdateNode }) {
  const isImage = node.type === 'image';
  const canPreview = isImage ? isImageContent(node.content) : isVideoContent(node.content);

  return (
    <>
      <input
        className="node-content-input"
        value={node.content}
        onChange={(event) => onUpdateNode(node.id, { content: event.target.value })}
        onPointerDown={(event) => event.stopPropagation()}
        placeholder={isImage ? '粘贴图片 URL 或 data URL' : '粘贴视频 URL 或 data URL'}
      />
      <div className={`image-preview ${isImage ? '' : 'video-preview'}`}>
        {canPreview ? (
          isImage ? (
            <img src={node.content} alt={node.title} />
          ) : (
            <video src={node.content} controls playsInline />
          )
        ) : (
          <div className="image-empty">无可预览内容</div>
        )}
      </div>
    </>
  );
}

function NoteToolbar({
  node,
  isRunning,
  isTranslating,
  onRunTextGeneration,
  onUpdateNode,
}) {
  const isPromptEmpty = !String(node.prompt || '').trim();

  return (
    <div className="node-bottom-toolbar" onPointerDown={(event) => event.stopPropagation()}>
      <textarea
        className="node-prompt-input"
        value={node.prompt || ''}
        onChange={(event) => onUpdateNode(node.id, { prompt: event.target.value, status: 'idle' })}
        placeholder="输入文字"
      />
      <div className="node-bottom-actions">
        <label className="node-model-picker" title="模型">
          <Bot size={14} />
          <select
            className="node-model-select"
            value={DEFAULT_TEXT_MODEL}
            onChange={(event) => event.preventDefault()}
          >
            <option value={DEFAULT_TEXT_MODEL}>{DEFAULT_TEXT_MODEL}</option>
          </select>
        </label>
        <div className="node-run-actions">
          <button
            className="icon-button"
            onClick={() => onRunTextGeneration(node, 'translate-en')}
            title="一键翻译英文"
            disabled={isTranslating || isRunning || isPromptEmpty}
          >
            {isTranslating ? <LoaderCircle size={14} className="spin-icon" /> : <Languages size={14} />}
            翻译
          </button>
          <button
            className="icon-button primary"
            onClick={() => onRunTextGeneration(node)}
            title="运行文本生成"
            disabled={isRunning || isTranslating || isPromptEmpty}
          >
            {isRunning ? <LoaderCircle size={14} className="spin-icon" /> : <Play size={14} />}
            运行
          </button>
        </div>
      </div>
    </div>
  );
}

export function CanvasNode({
  node,
  isSelected,
  isEditing,
  isRunning,
  isTranslating,
  linkFromNodeId,
  onSelectNode,
  onClearConnectionSelection,
  onBeginDrag,
  onEdit,
  onStopEditing,
  onUpdateNode,
  onRemoveNode,
  onRunTextGeneration,
  onPortPointerDown,
  onFinishLink,
}) {
  return (
    <article
      className={`node ${isSelected ? 'selected' : ''} ${node.type}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: node.width,
        height: node.height,
      }}
      onPointerDown={(event) => {
        onSelectNode(node.id);
        onClearConnectionSelection();
        if (node.type === 'note') {
          onBeginDrag(event, node);
        }
      }}
      onDoubleClick={() => {
        if (node.type === 'note') {
          onEdit(node.id);
        }
      }}
    >
      <div
        className="node-floating-header"
        onPointerDown={(event) => {
          if (node.type !== 'note') {
            onBeginDrag(event, node);
          }
        }}
      >
        <div className="node-title">
          <NodeIcon type={node.type} />
          <input
            value={node.title}
            onChange={(event) => onUpdateNode(node.id, { title: event.target.value })}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>
        <div className="node-header-actions">
          <button
            className="icon-mini danger"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveNode(node.id);
            }}
            title="删除节点"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="node-body">
        {node.type === 'note' ? (
          <NoteBody
            node={node}
            isEditing={isEditing}
            isRunning={isRunning}
            onBeginDrag={onBeginDrag}
            onEdit={onEdit}
            onUpdateNode={onUpdateNode}
            onStopEditing={onStopEditing}
          />
        ) : (
          <MediaBody node={node} onUpdateNode={onUpdateNode} />
        )}
      </div>

      {node.type === 'note' && isSelected ? (
        <NoteToolbar
          node={node}
          isRunning={isRunning}
          isTranslating={isTranslating}
          onRunTextGeneration={onRunTextGeneration}
          onUpdateNode={onUpdateNode}
        />
      ) : null}

      <button
        className={`port output ${linkFromNodeId === node.id ? 'active' : ''}`}
        onPointerDown={(event) => {
          onPortPointerDown(event, node.id);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (linkFromNodeId && linkFromNodeId !== node.id) onFinishLink(node.id);
        }}
        title="连线端口"
      />

      <button
        className={`port input ${linkFromNodeId === node.id ? 'active' : ''}`}
        onPointerDown={(event) => {
          onPortPointerDown(event, node.id);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (linkFromNodeId && linkFromNodeId !== node.id) onFinishLink(node.id);
        }}
        title="连线端口"
      />
    </article>
  );
}
