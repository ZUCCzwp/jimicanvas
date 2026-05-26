import { useEffect, useRef } from 'react';
import {
  Bot,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Copy,
  Languages,
  LoaderCircle,
  Maximize2,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { getNoteContentStyleCss } from '../lib/noteContentStyle';
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
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
  VEO_GENERATION_TYPE_OPTIONS,
  VEO_REFERENCE_IMAGE_MAX,
  VIDEO_FAMILY_OPTIONS,
} from '../lib/constants';
import { normalizeVideoUrl } from '../lib/videoApi';
import { isImageContent, isVideoContent } from '../lib/canvas';
import { formatTextInputLabel, getTextInputPreview } from '../lib/connections';
import { buildImageNodeLayoutPatch, resolveImageOutputLayout } from '../lib/imageNodeLayout';
import { normalizeImageUrl } from '../lib/imageApi';
import { CustomSelect } from './CustomSelect';
import { NodeGenerationState } from './NodeGenerationState';

function NodeIcon({ type }) {
  if (type === 'image') return <ImageIcon size={14} />;
  if (type === 'video') return <Film size={14} />;
  return <FileText size={14} />;
}

function getImageDisplayImages(node) {
  const images = Array.isArray(node.images) && node.images.length > 0 ? node.images : [];
  if (images.length > 0) return images;
  if (isImageContent(node.content)) return [node.content];
  return [];
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

function NodeEnlargeButton({ title, onClick }) {
  return (
    <button
      className="node-enlarge-button"
      type="button"
      title={title}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
    >
      <Maximize2 size={12} />
    </button>
  );
}

function NoteBody({ node, isSelected, isRunning, onBeginDrag, onOpenTextEdit }) {
  const contentStyleCss = getNoteContentStyleCss(node.contentStyle);

  if (isRunning) {
    return (
      <NodeGenerationState
        node={node}
        kind="text"
        label="正在运行"
        onBeginDrag={onBeginDrag}
      />
    );
  }

  function openContentEdit(event) {
    event?.stopPropagation?.();
    onOpenTextEdit(node.id, 'content');
  }

  if (node.status === 'error') {
    return (
      <div className="node-field-wrap node-text-display-wrap">
        {isSelected ? (
          <NodeEnlargeButton title="放大编辑结果" onClick={(event) => openContentEdit(event)} />
        ) : null}
        <div
          className="node-error-display"
          onPointerDown={(event) => onBeginDrag(event, node)}
          onDoubleClick={(event) => openContentEdit(event)}
        >
          <strong>运行失败</strong>
          <span style={contentStyleCss}>{node.content || '生成失败'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="node-field-wrap node-text-display-wrap">
      {isSelected ? (
        <NodeEnlargeButton title="放大编辑结果" onClick={(event) => openContentEdit(event)} />
      ) : null}
      <div
        className="node-text-display"
        style={contentStyleCss}
        onPointerDown={(event) => onBeginDrag(event, node)}
        onDoubleClick={(event) => openContentEdit(event)}
      >
        {node.content || '暂无结果'}
      </div>
    </div>
  );
}

function useImageOutputLayout(node, displayImages, onSyncOutputLayout) {
  const layoutSignatureRef = useRef('');
  const onSyncOutputLayoutRef = useRef(onSyncOutputLayout);
  const displayImagesKey = displayImages.join('|');

  onSyncOutputLayoutRef.current = onSyncOutputLayout;

  useEffect(() => {
    let cancelled = false;

    async function syncLayout() {
      const layout = await resolveImageOutputLayout({
        imageUrls: displayImages,
        imageRatio: node.imageRatio,
        imageCount: displayImages.length > 0 ? displayImages.length : node.imageCount,
      });
      const signature = `${layout.width}x${layout.height}x${layout.outputAspectCss}x${displayImages.length}`;
      if (layoutSignatureRef.current === signature) return;
      layoutSignatureRef.current = signature;

      if (!cancelled) {
        onSyncOutputLayoutRef.current?.(node.id, layout);
      }
    }

    syncLayout();
    return () => {
      cancelled = true;
    };
  }, [displayImagesKey, node.id, node.imageCount, node.imageRatio]);
}

function applyImageNodeLayout(node, displayImages, onSyncOutputLayout, aspectWidth, aspectHeight) {
  const layout = buildImageNodeLayoutPatch({
    imageRatio: node.imageRatio,
    imageCount: displayImages.length > 0 ? displayImages.length : node.imageCount,
    aspectWidth,
    aspectHeight,
  });
  onSyncOutputLayout?.(node.id, layout);
}

function ImageBody({
  node,
  isRunning,
  isInputsHighlighted = false,
  onBeginDrag,
  onHighlightInputs,
  onSyncOutputLayout,
}) {
  const displayImages = getImageDisplayImages(node);
  const imageCount = Math.min(Math.max(displayImages.length || 1, 1), 4);
  const loadedAspectRef = useRef('');

  useImageOutputLayout(node, displayImages, onSyncOutputLayout);

  function handleOutputImageLoad(event, index) {
    if (index !== 0) return;
    const img = event.currentTarget;
    const aspectWidth = img.naturalWidth;
    const aspectHeight = img.naturalHeight;
    if (!aspectWidth || !aspectHeight) return;

    const signature = `${aspectWidth}x${aspectHeight}x${displayImages.length}`;
    if (loadedAspectRef.current === signature) return;
    loadedAspectRef.current = signature;

    applyImageNodeLayout(node, displayImages, onSyncOutputLayout, aspectWidth, aspectHeight);
  }

  if (isRunning) {
    return (
      <NodeGenerationState
        node={node}
        kind="image"
        label="正在生成图片"
        onBeginDrag={onBeginDrag}
      />
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
      className={`image-output-grid image-count-${imageCount} ${isInputsHighlighted ? 'inputs-highlighted' : ''}`}
      onPointerDown={(event) => {
        onHighlightInputs?.(node.id);
        onBeginDrag(event, node);
      }}
    >
      {displayImages.length > 0 ? (
        displayImages.map((imageUrl, index) => (
          <div className="image-output-thumb" key={`${imageUrl}-${index}`}>
            <img
              src={normalizeImageUrl(imageUrl)}
              alt={`${node.title}-${index + 1}`}
              draggable={false}
              onLoad={(event) => handleOutputImageLoad(event, index)}
            />
          </div>
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
      <NodeGenerationState
        node={node}
        kind="video"
        label="正在生成视频"
        onBeginDrag={onBeginDrag}
      />
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

function referencePreviewSrc(image) {
  if (!image) return '';
  return image.source === 'local'
    ? image.url || image.data
    : normalizeImageUrl(image.url || image.data);
}

function VeoFrameSlot({ label, optional, image, disabled, blockedHint, onPick, onClear }) {
  const isBlocked = Boolean(disabled && blockedHint);
  return (
    <div className={`veo-frame-slot ${optional ? 'is-optional' : ''} ${isBlocked ? 'is-blocked' : ''}`}>
      <div className="veo-frame-slot-label">
        {label}
        {optional ? <span className="veo-frame-optional">可选</span> : null}
      </div>
      {image ? (
        <div className="veo-frame-preview">
          <img src={referencePreviewSrc(image)} alt={label} />
          <button type="button" onClick={onClear} disabled={disabled} title={`移除${label}`}>
            <X size={11} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="veo-frame-add"
          onClick={onPick}
          disabled={disabled}
          title={blockedHint || `选择${label}`}
        >
          <FolderOpen size={14} />
          选择
        </button>
      )}
      {isBlocked ? <span className="veo-frame-hint">{blockedHint}</span> : null}
    </div>
  );
}

function VideoToolbar({
  node,
  isRunning,
  isTranslating,
  onRunVideoGeneration,
  onOpenAssetLibrary,
  onRemoveImageReference,
  onRemoveVeoFrame,
  onUpdateNode,
}) {
  const isPromptEmpty = !String(node.prompt || '').trim();
  const references = Array.isArray(node.referenceImages) ? node.referenceImages : [];
  const family = inferVideoFamily(node);
  const isVeo = family === 'veo';
  const veoGenerationType = node.videoGenerationType || 'frame';
  const showVeoReferenceImages = isVeo && veoGenerationType === 'reference';
  const showGenericReferenceImages = !isVeo;
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
    generationType: node.videoGenerationType,
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
    const patch = {
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
    };

    if (nextFamily === 'veo') {
      patch.videoGenerationType = nextSettings.generationType;
    } else {
      patch.videoGenerationType = undefined;
      patch.videoFirstFrame = null;
      patch.videoLastFrame = null;
    }

    onUpdateNode(node.id, patch);
  }

  function applyVeoGenerationTypeChange(value) {
    const patch = { videoGenerationType: value, status: 'idle' };
    if (value === 'frame') {
      patch.referenceImages = [];
    } else {
      patch.videoFirstFrame = null;
      patch.videoLastFrame = null;
    }
    onUpdateNode(node.id, patch);
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
        {showVeoReferenceImages || showGenericReferenceImages ? (
          <button
            className="prompt-asset-button"
            onClick={() =>
              onOpenAssetLibrary(node.id, showVeoReferenceImages ? 'veo-reference' : 'reference')
            }
            disabled={
              isRunning ||
              (showVeoReferenceImages && references.length >= VEO_REFERENCE_IMAGE_MAX)
            }
            title={
              showVeoReferenceImages
                ? `从资产库选择参考图（最多 ${VEO_REFERENCE_IMAGE_MAX} 张）`
                : '从资产库选择参考图'
            }
          >
            <FolderOpen size={14} />
            资产库
          </button>
        ) : null}
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
      {isVeo ? (
        <OptionSegment
          title="生成类型"
          value={normalizedSettings.generationType || 'frame'}
          options={VEO_GENERATION_TYPE_OPTIONS}
          onChange={applyVeoGenerationTypeChange}
        />
      ) : null}
      {isVeo && veoGenerationType === 'frame' ? (
        <div className="veo-frame-row">
          <VeoFrameSlot
            label="首帧"
            image={node.videoFirstFrame}
            disabled={isRunning}
            onPick={() => onOpenAssetLibrary(node.id, 'veo-first')}
            onClear={() => onRemoveVeoFrame(node.id, 'first')}
          />
          <VeoFrameSlot
            label="尾帧"
            optional
            image={node.videoLastFrame}
            disabled={isRunning || !node.videoFirstFrame}
            blockedHint={!node.videoFirstFrame ? '请先选择首帧' : ''}
            onPick={() => {
              if (!node.videoFirstFrame) return;
              onOpenAssetLibrary(node.id, 'veo-last');
            }}
            onClear={() => onRemoveVeoFrame(node.id, 'last')}
          />
        </div>
      ) : null}
      <OptionSegment
        title="生成次数"
        value={normalizedSettings.count}
        options={countOptions.map((option) => ({ ...option, label: `${option.value}次` }))}
        onChange={(value) => onUpdateNode(node.id, { videoCount: Number(value) })}
      />
      {showVeoReferenceImages || showGenericReferenceImages ? (
        <div className="image-reference-row">
          <div className="image-reference-list">
            {references.map((image, index) => (
              <div className="image-reference-chip" key={image.id || image.url || index}>
                <img src={referencePreviewSrc(image)} alt={image.name || `参考图 ${index + 1}`} />
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
      ) : null}
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
  textInputLinks = [],
  onRunImageGeneration,
  onOpenAssetLibrary,
  onRemoveImageReference,
  onRemoveTextReference,
  onUpdateNode,
}) {
  const hasTextInput = textInputLinks.length > 0;
  const isPromptEmpty = !String(node.prompt || '').trim() && !hasTextInput;
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
  const displayImages = getImageDisplayImages(node);

  function patchLayout(overrides = {}) {
    return buildImageNodeLayoutPatch({
      imageRatio: overrides.imageRatio ?? node.imageRatio,
      imageCount: overrides.imageCount ?? (displayImages.length || node.imageCount),
    });
  }

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
              ...buildImageNodeLayoutPatch({
                imageRatio: nextSettings.ratio,
                imageCount: displayImages.length || nextSettings.count,
              }),
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
        onChange={(value) =>
          onUpdateNode(node.id, {
            imageRatio: value,
            status: 'idle',
            ...patchLayout({ imageRatio: value }),
          })
        }
        renderIcon={(option) => <RatioIcon value={option.value} />}
      />
      <OptionSegment
        title="生成数量"
        value={normalizedSettings.count}
        options={countOptions.map((option) => ({ ...option, label: `${option.value}张` }))}
        onChange={(value) =>
          onUpdateNode(node.id, {
            imageCount: Number(value),
            ...patchLayout({ imageCount: Number(value) }),
          })
        }
      />
      {hasTextInput ? (
        <div className="image-reference-row">
          <span className="image-reference-label">文本引用</span>
          <div className="image-reference-list">
            {textInputLinks.map(({ linkId, node: textNode }) => (
              <div className="text-reference-chip" key={linkId}>
                <FileText size={14} />
                <span className="text-reference-preview" title={getTextInputPreview(textNode) || '空文本'}>
                  {formatTextInputLabel(textNode)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveTextReference(linkId)}
                  title="移除文本引用并断开连线"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="image-reference-row">
        <span className="image-reference-label">参考图</span>
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
  onOpenTextEdit,
}) {
  const isPromptEmpty = !String(node.prompt || '').trim();

  return (
    <div className="node-bottom-toolbar" onPointerDown={(event) => event.stopPropagation()}>
      <div className="node-field-wrap node-prompt-wrap">
        <textarea
          className="node-prompt-input"
          value={node.prompt || ''}
          onChange={(event) => onUpdateNode(node.id, { prompt: event.target.value, status: 'idle' })}
          placeholder="输入文字"
        />
        <NodeEnlargeButton
          title="放大编辑输入"
          onClick={() => onOpenTextEdit(node.id, 'prompt')}
        />
      </div>
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
  isRunning,
  isTranslating,
  textInputLinks = [],
  isInputsHighlighted = false,
  linkFromNodeId,
  onSelectNode,
  onClearConnectionSelection,
  onBeginDrag,
  onBeginResize,
  onOpenTextEdit,
  onCopyNode,
  onUpdateNode,
  onRemoveNode,
  onRunTextGeneration,
  onRunImageGeneration,
  onRunVideoGeneration,
  onOpenAssetLibrary,
  onRemoveImageReference,
  onRemoveTextReference,
  onHighlightInputs,
  onPreviewImage,
  onSyncImageOutputLayout,
  onRemoveVeoFrame,
  onPortPointerDown,
  onFinishLink,
}) {
  const imageDisplayImages = node.type === 'image' ? getImageDisplayImages(node) : [];

  return (
    <article
      className={`node ${isSelected ? 'selected' : ''} ${isRunning ? 'is-running' : ''} ${node.type}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: node.width ?? DEFAULT_NODE_WIDTH,
        height: node.height ?? DEFAULT_NODE_HEIGHT,
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
          onOpenTextEdit(node.id, 'content');
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
        <div
          className="node-header-actions"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          {node.type === 'image' && imageDisplayImages.length > 0 ? (
            <button
              className="icon-mini"
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onPreviewImage?.(imageDisplayImages, 0);
              }}
              title="预览图片"
            >
              <Maximize2 size={14} />
            </button>
          ) : null}
          <button
            className="icon-mini"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onCopyNode(node.id);
            }}
            title="复制节点"
          >
            <Copy size={14} />
          </button>
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
            isSelected={isSelected}
            isRunning={isRunning}
            onBeginDrag={onBeginDrag}
            onOpenTextEdit={onOpenTextEdit}
          />
        ) : node.type === 'image' ? (
          <ImageBody
            node={node}
            isRunning={isRunning}
            isInputsHighlighted={isInputsHighlighted}
            onBeginDrag={onBeginDrag}
            onHighlightInputs={onHighlightInputs}
            onSyncOutputLayout={onSyncImageOutputLayout}
          />
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
          onOpenTextEdit={onOpenTextEdit}
        />
      ) : node.type === 'image' && isSelected ? (
        <ImageToolbar
          node={node}
          isRunning={isRunning}
          isTranslating={isTranslating}
          textInputLinks={textInputLinks}
          onRunImageGeneration={onRunImageGeneration}
          onOpenAssetLibrary={onOpenAssetLibrary}
          onRemoveImageReference={onRemoveImageReference}
          onRemoveTextReference={onRemoveTextReference}
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
          onRemoveVeoFrame={onRemoveVeoFrame}
          onUpdateNode={onUpdateNode}
        />
      ) : null}

      {node.type === 'note' && isSelected ? (
        <button
          type="button"
          className="node-resize-handle"
          title="拖拽调整输出框大小"
          aria-label="调整节点大小"
          onPointerDown={(event) => {
            event.stopPropagation();
            onBeginResize(event, node);
          }}
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
