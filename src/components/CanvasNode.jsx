import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Languages,
  LoaderCircle,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_TEXT_MODEL,
  getImageCountOptions,
  getVideoCountOptions,
  getVideoDurationOptions,
  getVideoModelOptions,
  getVideoRatioOptions,
  getVideoResolutionOptions,
  defaultSoraSize,
  inferVideoFamily,
  isSeedanceManxueModel,
  IMAGE_MODEL_OPTIONS,
  getImageRatioOptions,
  getImageResolutionOptions,
  normalizeImageModelSettings,
  normalizeVideoModelSettings,
  VIDEO_FAMILY_OPTIONS,
} from '../lib/constants';
import { normalizeVideoUrl } from '../lib/videoApi';
import { isImageContent, isVideoContent } from '../lib/canvas';
import { normalizeImageUrl } from '../lib/imageApi';

function NodeIcon({ type }) {
  if (type === 'image') return <ImageIcon size={14} />;
  if (type === 'video') return <Film size={14} />;
  return <FileText size={14} />;
}

function CustomSelect({
  icon,
  label,
  title,
  value,
  options,
  onChange,
  compact = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`custom-select ${open ? 'open' : ''} ${compact ? 'compact' : ''} ${className}`}
      title={title}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon}
        {label ? <span className="custom-select-prefix">{label}</span> : null}
        <span className="custom-select-value">{selected?.label}</span>
        <ChevronDown size={13} className="custom-select-arrow" />
      </button>
      {open ? (
        <div className="custom-select-menu" role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <span>{option.label}</span>
                {isSelected ? <Check size={13} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function OptionSegment({ title, options, value, onChange, renderIcon }) {
  return (
    <div className="option-segment">
      <div className="option-segment-title">{title}</div>
      <div className="option-segment-control">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className={`option-segment-button ${isActive ? 'active' : ''}`}
              onClick={() => onChange(option.value)}
              title={option.label}
            >
              {renderIcon ? renderIcon(option) : null}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RatioIcon({ value }) {
  const [width = 1, height = 1] = String(value)
    .split(':')
    .map((part) => Number(part) || 1);
  const isTall = height > width;
  const isWide = width > height;

  return (
    <span
      className={`ratio-icon ${isWide ? 'wide' : ''} ${isTall ? 'tall' : ''}`}
      aria-hidden="true"
    />
  );
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

function ImageBody({ node, isRunning, onBeginDrag }) {
  const images = Array.isArray(node.images) && node.images.length > 0 ? node.images : [];
  const displayImages = images.length > 0 ? images : isImageContent(node.content) ? [node.content] : [];

  if (isRunning) {
    return (
      <div className="image-output-state" onPointerDown={(event) => onBeginDrag(event, node)}>
        <LoaderCircle size={24} className="spin-icon" />
        <span>正在生成图片</span>
      </div>
    );
  }

  if (node.status === 'error') {
    return (
      <div
        className="node-error-display image-error-display"
        onPointerDown={(event) => onBeginDrag(event, node)}
      >
        <strong>生成失败</strong>
        <span>{node.content || '图片生成失败'}</span>
      </div>
    );
  }

  return (
    <div
      className={`image-output-grid image-count-${Math.min(displayImages.length || 1, 4)}`}
      onPointerDown={(event) => onBeginDrag(event, node)}
    >
      {displayImages.length > 0 ? (
        displayImages.map((imageUrl, index) => (
          <img
            key={`${imageUrl}-${index}`}
            src={normalizeImageUrl(imageUrl)}
            alt={`${node.title}-${index + 1}`}
            draggable={false}
          />
        ))
      ) : (
        <div className="image-empty">点击节点，在下方输入提示词生成图片</div>
      )}
    </div>
  );
}

function VideoBody({ node, isRunning, onBeginDrag }) {
  const videos = Array.isArray(node.videos) && node.videos.length > 0 ? node.videos : [];
  const displayVideo =
    videos.length > 0
      ? videos[0]
      : isVideoContent(node.content)
        ? node.content
        : '';

  if (isRunning) {
    return (
      <div className="video-output-state" onPointerDown={(event) => onBeginDrag(event, node)}>
        <LoaderCircle size={24} className="spin-icon" />
        <span>正在生成视频</span>
      </div>
    );
  }

  if (node.status === 'error') {
    return (
      <div
        className="node-error-display image-error-display"
        onPointerDown={(event) => onBeginDrag(event, node)}
      >
        <strong>生成失败</strong>
        <span>{node.content || '视频生成失败'}</span>
      </div>
    );
  }

  return (
    <div className="video-output-preview" onPointerDown={(event) => onBeginDrag(event, node)}>
      {displayVideo ? (
        <video src={normalizeVideoUrl(displayVideo)} controls playsInline />
      ) : (
        <div className="image-empty">单击节点，在下方配置提示词并生成视频</div>
      )}
    </div>
  );
}

function ratioIconValue(family, value) {
  if (family === 'sora') {
    return value === 'portrait' ? '9:16' : '16:9';
  }
  return value;
}

function VideoToolbar({
  node,
  isRunning,
  isTranslating,
  onRunVideoGeneration,
  onOpenAssetLibrary,
  onRemoveImageReference,
  onUpdateNode,
}) {
  const isPromptEmpty = !String(node.prompt || '').trim();
  const references = Array.isArray(node.referenceImages) ? node.referenceImages : [];
  const family = inferVideoFamily(node);
  const model = node.videoModel || getVideoModelOptions(family)[0]?.value;
  const isManxueSeedance = family === 'seedance' && isSeedanceManxueModel(model);
  const modelOptions = getVideoModelOptions(family);
  const resolutionOptions = getVideoResolutionOptions(family, model);
  const ratioOptions = getVideoRatioOptions(family);
  const durationOptions = getVideoDurationOptions(family, model);
  const countOptions = getVideoCountOptions(family);
  const normalizedSettings = normalizeVideoModelSettings({
    family,
    model: node.videoModel,
    size: node.videoSize,
    resolution: node.videoResolution,
    orientation: node.videoOrientation,
    ratio: node.videoRatio,
    quality: node.videoQuality,
    duration: node.videoDuration,
    count: node.videoCount,
    route: node.videoRoute,
  });

  const resolutionValue =
    family === 'sora'
      ? normalizedSettings.size
      : family === 'grok'
        ? normalizedSettings.quality
        : normalizedSettings.resolution;
  const ratioValue = family === 'sora' ? normalizedSettings.orientation : normalizedSettings.ratio;
  const resolutionTitle = family === 'grok' ? '画质' : '分辨率';

  function applyFamilyChange(nextFamily) {
    const nextSettings = normalizeVideoModelSettings({ family: nextFamily });
    onUpdateNode(node.id, {
      videoFamily: nextFamily,
      videoModel: nextSettings.model,
      videoRoute: nextSettings.route,
      videoSize: nextSettings.size || node.videoSize,
      videoResolution: nextSettings.resolution || node.videoResolution,
      videoQuality: nextSettings.quality || node.videoQuality,
      videoOrientation: nextSettings.orientation || node.videoOrientation,
      videoRatio: nextSettings.ratio || node.videoRatio,
      videoDuration: nextSettings.duration,
      videoCount: nextSettings.count,
      status: 'idle',
    });
  }

  function applyModelChange(value) {
    const defaultResolution = value === 'seedance-2.0-manxue' ? '720p' : node.videoResolution;
    const nextSettings = normalizeVideoModelSettings({
      family,
      model: value,
      size: node.videoSize,
      resolution: defaultResolution,
      orientation: node.videoOrientation,
      ratio: node.videoRatio,
      quality: node.videoQuality,
      duration: node.videoDuration,
      count: node.videoCount,
      route: node.videoRoute,
    });
    onUpdateNode(node.id, {
      videoModel: nextSettings.model,
      videoSize: nextSettings.size,
      videoResolution: nextSettings.resolution,
      videoQuality: nextSettings.quality,
      videoOrientation: nextSettings.orientation,
      videoRatio: nextSettings.ratio,
      videoDuration: nextSettings.duration,
      videoCount: nextSettings.count,
    });
  }

  const showResolutionControl = resolutionOptions.length > 0;

  return (
    <div className="node-bottom-toolbar image-toolbar video-toolbar" onPointerDown={(event) => event.stopPropagation()}>
      <div className="node-prompt-wrap">
        <textarea
          className="node-prompt-input"
          value={node.prompt || ''}
          onChange={(event) => onUpdateNode(node.id, { prompt: event.target.value, status: 'idle' })}
          placeholder="输入视频提示词"
        />
        <button
          className="prompt-asset-button"
          onClick={() => onOpenAssetLibrary(node.id)}
          disabled={isRunning}
          title="从资产库选择参考图"
        >
          <FolderOpen size={14} />
          资产库
        </button>
      </div>
      <OptionSegment
        title="系列"
        value={family}
        options={VIDEO_FAMILY_OPTIONS}
        onChange={applyFamilyChange}
      />
      <div className="image-options-row">
        <OptionSegment
          title="模型"
          value={normalizedSettings.model}
          options={modelOptions}
          onChange={applyModelChange}
        />
        {showResolutionControl ? (
          <OptionSegment
            title={resolutionTitle}
            value={resolutionValue}
            options={resolutionOptions}
            onChange={(value) => {
              if (family === 'grok') {
                onUpdateNode(node.id, { videoQuality: value });
                return;
              }
              onUpdateNode(node.id, { videoResolution: value });
            }}
          />
        ) : null}
      </div>
      <div className="image-options-row">
        <OptionSegment
          title="宽高比"
          value={ratioValue}
          options={ratioOptions}
          onChange={(value) => {
            if (family === 'sora') {
              onUpdateNode(node.id, {
                videoOrientation: value,
                videoSize: defaultSoraSize(value),
              });
              return;
            }
            onUpdateNode(node.id, { videoRatio: value });
          }}
          renderIcon={(option) => <RatioIcon value={ratioIconValue(family, option.value)} />}
        />
        <OptionSegment
          title="时长"
          value={normalizedSettings.duration}
          options={durationOptions}
          onChange={(value) => onUpdateNode(node.id, { videoDuration: value })}
        />
      </div>
      <OptionSegment
        title="生成次数"
        value={normalizedSettings.count}
        options={countOptions.map((option) => ({ ...option, label: `${option.value}次` }))}
        onChange={(value) => onUpdateNode(node.id, { videoCount: Number(value) })}
      />
      <div className="image-reference-row">
        <div className="image-reference-list">
          {references.map((image, index) => (
            <div className="image-reference-chip" key={image.id || image.url || index}>
              <img
                src={image.source === 'local' ? image.url || image.data : normalizeImageUrl(image.url || image.data)}
                alt={image.name || `参考图 ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => onRemoveImageReference(node.id, index)}
                title="移除参考图"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="node-bottom-actions image-bottom-actions">
        <button
          className="icon-button"
          onClick={() => onRunVideoGeneration(node, 'translate')}
          title="翻译提示词"
          disabled={isTranslating || isRunning || isPromptEmpty}
        >
          {isTranslating ? <LoaderCircle size={14} className="spin-icon" /> : <Languages size={14} />}
          翻译
        </button>
        <button
          className="icon-button primary"
          onClick={() => onRunVideoGeneration(node)}
          title="运行视频生成"
          disabled={isRunning || isTranslating || isPromptEmpty}
        >
          {isRunning ? <LoaderCircle size={14} className="spin-icon" /> : <Play size={14} />}
          运行
        </button>
      </div>
    </div>
  );
}

function ImageToolbar({
  node,
  isRunning,
  isTranslating,
  onRunImageGeneration,
  onOpenAssetLibrary,
  onRemoveImageReference,
  onUpdateNode,
}) {
  const isPromptEmpty = !String(node.prompt || '').trim();
  const references = Array.isArray(node.referenceImages) ? node.referenceImages : [];
  const model = node.imageModel || IMAGE_MODEL_OPTIONS[0].value;
  const resolutionOptions = getImageResolutionOptions(model);
  const ratioOptions = getImageRatioOptions(model);
  const countOptions = getImageCountOptions(model);
  const normalizedSettings = normalizeImageModelSettings({
    model,
    resolution: node.imageResolution,
    ratio: node.imageRatio,
    count: node.imageCount,
  });

  return (
    <div className="node-bottom-toolbar image-toolbar" onPointerDown={(event) => event.stopPropagation()}>
      <div className="node-prompt-wrap">
        <textarea
          className="node-prompt-input"
          value={node.prompt || ''}
          onChange={(event) => onUpdateNode(node.id, { prompt: event.target.value, status: 'idle' })}
          placeholder="输入图片提示词"
        />
        <button
          className="prompt-asset-button"
          onClick={() => onOpenAssetLibrary(node.id)}
          disabled={isRunning}
          title="从资产库选择"
        >
          <FolderOpen size={14} />
          资产库
        </button>
      </div>
      <div className="image-options-row">
        <OptionSegment
          title="模型"
          value={model}
          options={IMAGE_MODEL_OPTIONS}
          onChange={(value) => {
            const nextSettings = normalizeImageModelSettings({
              model: value,
              resolution: node.imageResolution,
              ratio: node.imageRatio,
              count: node.imageCount,
            });
            onUpdateNode(node.id, {
              imageModel: value,
              imageResolution: nextSettings.resolution,
              imageRatio: nextSettings.ratio,
              imageCount: nextSettings.count,
            });
          }}
        />
        <OptionSegment
          title="分辨率"
          value={normalizedSettings.resolution}
          options={resolutionOptions}
          onChange={(value) => onUpdateNode(node.id, { imageResolution: value })}
        />
      </div>
      <OptionSegment
        title="尺寸"
        value={normalizedSettings.ratio}
        options={ratioOptions}
        onChange={(value) => onUpdateNode(node.id, { imageRatio: value })}
        renderIcon={(option) => <RatioIcon value={option.value} />}
      />
      <OptionSegment
        title="生成数量"
        value={normalizedSettings.count}
        options={countOptions.map((option) => ({ ...option, label: `${option.value}张` }))}
        onChange={(value) => onUpdateNode(node.id, { imageCount: Number(value) })}
      />
      <div className="image-reference-row">
        <div className="image-reference-list">
          {references.map((image, index) => (
            <div className="image-reference-chip" key={image.id || image.url || index}>
              <img
                src={image.source === 'local' ? image.url || image.data : normalizeImageUrl(image.url || image.data)}
                alt={image.name || `参考图 ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => onRemoveImageReference(node.id, index)}
                title="移除参考图"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="node-bottom-actions image-bottom-actions">
        <button
          className="icon-button"
          onClick={() => onRunImageGeneration(node, 'translate')}
          title="翻译提示词"
          disabled={isTranslating || isRunning || isPromptEmpty}
        >
          {isTranslating ? <LoaderCircle size={14} className="spin-icon" /> : <Languages size={14} />}
          翻译
        </button>
        <button
          className="icon-button primary"
          onClick={() => onRunImageGeneration(node)}
          title="运行图片生成"
          disabled={isRunning || isTranslating || isPromptEmpty}
        >
          {isRunning ? <LoaderCircle size={14} className="spin-icon" /> : <Play size={14} />}
          运行
        </button>
      </div>
    </div>
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
        <CustomSelect
          title="模型"
          icon={<Bot size={14} />}
          value={DEFAULT_TEXT_MODEL}
          options={[{ value: DEFAULT_TEXT_MODEL, label: DEFAULT_TEXT_MODEL }]}
          onChange={() => {}}
        />
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
  onRunImageGeneration,
  onRunVideoGeneration,
  onOpenAssetLibrary,
  onRemoveImageReference,
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
        ) : node.type === 'image' ? (
          <ImageBody node={node} isRunning={isRunning} onBeginDrag={onBeginDrag} />
        ) : (
          <VideoBody node={node} isRunning={isRunning} onBeginDrag={onBeginDrag} />
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
      ) : node.type === 'image' && isSelected ? (
        <ImageToolbar
          node={node}
          isRunning={isRunning}
          isTranslating={isTranslating}
          onRunImageGeneration={onRunImageGeneration}
          onOpenAssetLibrary={onOpenAssetLibrary}
          onRemoveImageReference={onRemoveImageReference}
          onUpdateNode={onUpdateNode}
        />
      ) : node.type === 'video' && isSelected ? (
        <VideoToolbar
          node={node}
          isRunning={isRunning}
          isTranslating={isTranslating}
          onRunVideoGeneration={onRunVideoGeneration}
          onOpenAssetLibrary={onOpenAssetLibrary}
          onRemoveImageReference={onRemoveImageReference}
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
