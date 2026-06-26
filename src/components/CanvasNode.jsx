import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  FileText,
  Film,
  FolderOpen,
  Headphones,
  Image as ImageIcon,
  Upload,
  Copy,
  Download,
  Languages,
  LoaderCircle,
  Maximize2,
  Play,
  Trash2,
  X,
  Scissors,
  Check,
  Sparkles,
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
  getVideoReferenceImageMax,
  IMAGE_MODEL_OPTIONS,
  getImageRatioOptions,
  getImageResolutionOptions,
  getImageQualityOptions,
  normalizeImageModelSettings,
  normalizeVideoModelSettings,
  VEO_GENERATION_TYPE_OPTIONS,
  DEFAULT_IMAGE_URL,
  DEFAULT_VIDEO_URL,
  PLACEHOLDER_IMAGE,
  VEO_REFERENCE_IMAGE_MAX,
  SEEDANCE_REF_IMAGE_MAX,
  SEEDANCE_REF_VIDEO_MAX,
  SEEDANCE_REF_AUDIO_MAX,
  getImageReferenceMax,
  VIDEO_FAMILY_OPTIONS,
  AUDIO_VOICE_OPTIONS,
  AUDIO_SPEED_OPTIONS,
  MIN_AUDIO_NODE_HEIGHT,
  MIN_AUDIO_NODE_HEIGHT_WITH_CONTENT,
  DEFAULT_AUDIO_NODE_WIDTH,
  DEFAULT_AUDIO_MODEL,
} from '../lib/constants';
import { getStoredChatToken } from '../lib/jimiaigoApi';
import { getSd2ManxueAssetList, normalizeVideoUrl, resolveSeedanceMediaPreviewUrl } from '../lib/videoApi';
import { isImageContent, isVideoContent, isAudioContent } from '../lib/canvas';
import { normalizeAudioUrl, AUDIO_FILE_ACCEPT, filterAudioFiles } from '../lib/audioApi';
import {
  formatImageInputLabel,
  formatTextInputLabel,
  formatVideoInputLabel,
  getImageNodeOutputUrl,
  getTextInputPreview,
  getVideoNodeOutputUrl,
  isImageToPromptNode,
  isVideoToPromptNode,
  mergeImageReferenceImages,
  resolveNoteImageInputUrls,
  resolveNoteVideoInputUrls,
  resolveVideoToolbarFrames,
  resolveVideoToolbarReferences,
} from '../lib/connections';
import {
  buildImageNodeLayoutPatch,
  getImageNodeDisplayImages,
  hasRealImageNodeOutput,
  isDefaultDemoImageOutput,
  resolveImageOutputLayout,
} from '../lib/imageNodeLayout';
import { buildVideoNodeLayoutPatch } from '../lib/videoNodeLayout';
import { normalizeImageUrl } from '../lib/imageApi';
import { calculateEstimatedCost } from '../lib/pricing';
import JimicoinIcon from './JimicoinIcon';
import { CustomSelect } from './CustomSelect';
import { NodeGenerationState } from './NodeGenerationState';
import { ReferenceImageChip, ReferencePromptInput } from './ReferencePromptControls';

function NodeIcon({ type }) {
  if (type === 'image') return <ImageIcon size={14} />;
  if (type === 'video') return <Film size={14} />;
  if (type === 'audio') return <Headphones size={14} />;
  return <FileText size={14} />;
}

function getImageDisplayImages(node) {
  return getImageNodeDisplayImages(node);
}

function isDefaultDemoMediaUrl(url, defaultUrl) {
  const value = String(url || '').trim();
  if (!value || !defaultUrl) return false;
  return value === defaultUrl || value.endsWith(defaultUrl);
}

function DemoSampleBadge() {
  return <span className="node-output-demo-badge">示例</span>;
}

function OptionSegment({ title, options, value, onChange, renderIcon }) {
  return (
    <div className="option-segment">
      <div className="option-segment-title">{title}</div>
      <div className="option-segment-control">
        {options.map((option) => {
          const isActive = option.value === value;
          const tooltip = option.hint ? `${option.label} · ${option.hint}` : option.label;
          return (
            <button
              key={option.value}
              type="button"
              className={`option-segment-button ${option.hint ? 'has-hint' : ''} ${isActive ? 'active' : ''}`}
              onClick={() => onChange(option.value)}
              title={tooltip}
            >
              {renderIcon ? renderIcon(option) : null}
              <span className="option-segment-button-text">
                <span className="option-segment-button-label">{option.label}</span>
                {option.hint ? (
                  <span className="option-segment-button-hint">{option.hint}</span>
                ) : null}
              </span>
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
  }, [displayImagesKey, node.id]);
}

function ImageBody({
  node,
  isRunning,
  showOutputActions = false,
  isInputsHighlighted = false,
  onBeginDrag,
  onHighlightInputs,
  onOpenAssetLibrary,
  onUploadImageOutput,
  onSyncOutputLayout,
}) {
  const displayImages = getImageDisplayImages(node);
  const showDemoBadge = isDefaultDemoImageOutput(displayImages);
  const imageCount = Math.min(Math.max(displayImages.length || 1, 1), 4);
  const maxUploadCount = Math.min(4, Math.max(1, Number(node.imageCount) || 1));
  const outputFileInputRef = useRef(null);

  useImageOutputLayout(node, displayImages, onSyncOutputLayout);

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
      {showDemoBadge ? (
        <div className="node-output-demo-badge-wrap" onPointerDown={(event) => event.stopPropagation()}>
          <DemoSampleBadge />
        </div>
      ) : null}

      {showOutputActions && (onOpenAssetLibrary || onUploadImageOutput) ? (
        <div
          className="image-output-actions"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {onUploadImageOutput ? (
            <>
              <button
                type="button"
                className="image-output-action-button"
                title="上传本地图片"
                onClick={(event) => {
                  event.stopPropagation();
                  outputFileInputRef.current?.click();
                }}
              >
                <Upload size={12} />
                <span>上传</span>
              </button>
              <input
                ref={outputFileInputRef}
                type="file"
                accept="image/*"
                multiple={maxUploadCount > 1}
                hidden
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  if (files.length > 0) {
                     onUploadImageOutput(node.id, files);
                  }
                  event.target.value = '';
                }}
              />
            </>
          ) : null}
          {onOpenAssetLibrary ? (
            <button
              type="button"
              className="image-output-action-button"
              title="从资产库选择图片"
              onClick={(event) => {
                event.stopPropagation();
                onOpenAssetLibrary(node.id, 'output');
              }}
            >
              <FolderOpen size={12} />
              <span>资产库</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {displayImages.length > 0 ? (
        displayImages.map((imageUrl, index) => (
          <div className="image-output-thumb" key={`${imageUrl}-${index}`}>
            <img
              src={normalizeImageUrl(imageUrl)}
              alt={`${node.title}-${index + 1}`}
              draggable={false}
            />
          </div>
        ))
      ) : (
        <div className="image-empty">
          <span>输入提示词生成图片</span>
        </div>
      )}
    </div>
  );
}

function getVideoDisplayUrl(node) {
  const videos = Array.isArray(node.videos) && node.videos.length > 0 ? node.videos : [];
  if (videos.length > 0) return videos[0];
  if (isVideoContent(node.content)) return node.content;
  return '';
}

function useVideoOutputLayout(node, displayVideo, onSyncOutputLayout) {
  const layoutSignatureRef = useRef('');
  const onSyncOutputLayoutRef = useRef(onSyncOutputLayout);

  onSyncOutputLayoutRef.current = onSyncOutputLayout;

  useEffect(() => {
    if (displayVideo) return undefined;

    const layout = buildVideoNodeLayoutPatch(node);
    const signature = `${layout.width}x${layout.height}x${layout.outputAspectCss}`;
    if (layoutSignatureRef.current === signature) return undefined;
    layoutSignatureRef.current = signature;
    onSyncOutputLayoutRef.current?.(node.id, layout);
    return undefined;
  }, [displayVideo, node.id, node.videoFamily, node.videoOrientation, node.videoRatio, node.videoSize]);
}

function shouldApplyVideoLayout(node, layout) {
  return !(
    node.width === layout.width &&
    node.height === layout.height &&
    node.outputAspectCss === layout.outputAspectCss
  );
}

function applyVideoNodeLayout(node, onSyncOutputLayout, aspectWidth, aspectHeight) {
  const layout = buildVideoNodeLayoutPatch(
    node,
    aspectWidth && aspectHeight ? { width: aspectWidth, height: aspectHeight } : null
  );
  if (!shouldApplyVideoLayout(node, layout)) return;
  onSyncOutputLayout?.(node.id, layout);
}

function VideoBody({
  node,
  isRunning,
  showOutputActions = false,
  isInputsHighlighted = false,
  onBeginDrag,
  onHighlightInputs,
  onOpenAssetLibrary,
  onUploadVideoOutput,
  onSyncOutputLayout,
  onExtractVideoFrame,
  onExtractVideoClip,
  onExtractVideoAudio,
}) {
  const displayVideo = getVideoDisplayUrl(node);
  const showDemoBadge = isDefaultDemoMediaUrl(displayVideo, DEFAULT_VIDEO_URL);
  const loadedAspectRef = useRef('');
  const videoRef = useRef(null);
  const hoverPreviewRef = useRef(false);
  const outputFileInputRef = useRef(null);

  const [videoDuration, setVideoDuration] = useState(0);
  const [isClipping, setIsClipping] = useState(false);
  const [isExtractingAudio, setIsExtractingAudio] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(10);
  const trackRef = useRef(null);

  const handlePointerDown = (event, type) => {
    event.stopPropagation();
    event.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const duration = videoDuration || 10;

    const handlePointerMove = (moveEvent) => {
      const offsetX = moveEvent.clientX - rect.left;
      const percentage = Math.min(1, Math.max(0, offsetX / rect.width));
      const targetTime = percentage * duration;

      if (type === 'start') {
        const nextStart = Math.min(targetTime, clipEnd - 0.5);
        setClipStart(nextStart);
        if (videoRef.current) {
          videoRef.current.currentTime = nextStart;
        }
      } else {
        const nextEnd = Math.max(targetTime, clipStart + 0.5);
        setClipEnd(nextEnd);
        if (videoRef.current) {
          videoRef.current.currentTime = nextEnd;
        }
      }
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  function handleConfirmClip() {
    onExtractVideoClip?.(node.id, displayVideo, clipStart, clipEnd);
    setIsClipping(false);
  }

  async function handleExtractAudio(event) {
    event.stopPropagation();
    event.preventDefault();
    if (isExtractingAudio || !onExtractVideoAudio) return;

    hoverPreviewRef.current = false;
    videoRef.current?.pause();

    let seedAudioContext = null;
    try {
      seedAudioContext = new AudioContext();
      if (seedAudioContext.state === 'suspended') {
        void seedAudioContext.resume();
      }
    } catch {
      seedAudioContext = null;
    }

    setIsExtractingAudio(true);
    try {
      await onExtractVideoAudio(node.id, displayVideo, {
        audioContext: seedAudioContext,
      });
    } finally {
      if (seedAudioContext && seedAudioContext.state !== 'closed') {
        void seedAudioContext.close();
      }
      setIsExtractingAudio(false);
    }
  }

  useVideoOutputLayout(node, displayVideo, onSyncOutputLayout);

  function stopHoverPreview() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // ignore seek errors while metadata is loading
    }
  }

  async function startHoverPreview() {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.readyState < 1) return;
      video.currentTime = 0;
      video.muted = false;
      await video.play();
    } catch {
      // If unmuted playback is blocked, try muted playback as fallback
      try {
        video.muted = true;
        await video.play();
      } catch {
        // ignore
      }
    }
  }

  function handleVideoLoadedMetadata(event) {
    const video = event.currentTarget;
    setVideoDuration(video.duration || 0);
    setClipEnd(video.duration || 10);
    const aspectWidth = video.videoWidth;
    const aspectHeight = video.videoHeight;
    if (!aspectWidth || !aspectHeight) return;

    const signature = `${aspectWidth}x${aspectHeight}`;
    if (loadedAspectRef.current === signature) return;
    loadedAspectRef.current = signature;

    applyVideoNodeLayout(node, onSyncOutputLayout, aspectWidth, aspectHeight);
    if (hoverPreviewRef.current) {
      startHoverPreview();
    }
  }

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
    <div
      className={`video-output-preview ${isInputsHighlighted ? 'inputs-highlighted' : ''}`}
      onPointerDown={(event) => {
        onHighlightInputs?.(node.id);
        onBeginDrag(event, node);
      }}
    >
      {showDemoBadge ? (
        <div className="node-output-demo-badge-wrap" onPointerDown={(event) => event.stopPropagation()}>
          <DemoSampleBadge />
        </div>
      ) : null}

      {showOutputActions && (onOpenAssetLibrary || onUploadVideoOutput) ? (
        <div
          className="image-output-actions"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {onUploadVideoOutput ? (
            <>
              <button
                type="button"
                className="image-output-action-button"
                title="上传本地视频"
                onClick={(event) => {
                  event.stopPropagation();
                  outputFileInputRef.current?.click();
                }}
              >
                <Upload size={12} />
                <span>上传</span>
              </button>
              <input
                ref={outputFileInputRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  if (files.length > 0) {
                    onUploadVideoOutput(node.id, files);
                  }
                  event.target.value = '';
                }}
              />
            </>
          ) : null}
          {onOpenAssetLibrary ? (
            <button
              type="button"
              className="image-output-action-button"
              title="从资产库选择视频"
              onClick={(event) => {
                event.stopPropagation();
                onOpenAssetLibrary(node.id, 'video-output');
              }}
            >
              <FolderOpen size={12} />
              <span>资产库</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {displayVideo ? (
        <div
          className="video-output-thumb"
          onPointerEnter={() => {
            if (isClipping) return;
            hoverPreviewRef.current = true;
            startHoverPreview();
          }}
          onPointerLeave={() => {
            if (isClipping) return;
            hoverPreviewRef.current = false;
            stopHoverPreview();
          }}
        >
          <video
            ref={videoRef}
            key={displayVideo}
            src={normalizeVideoUrl(displayVideo)}
            muted={false}
            playsInline
            preload="auto"
            draggable={false}
            onLoadedMetadata={handleVideoLoadedMetadata}
            onEnded={stopHoverPreview}
          />
          {!isClipping && (
            <div
              className={`video-frame-extract-actions ${isExtractingAudio ? 'is-active' : ''}`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="image-output-action-button"
                title="截取视频第一帧为图片节点"
                data-tooltip="截首帧"
                onClick={(event) => {
                  event.stopPropagation();
                  onExtractVideoFrame?.(node.id, displayVideo, 'first');
                }}
              >
                <ImageIcon size={13} />
                <span>截首帧</span>
              </button>
              <button
                type="button"
                className="image-output-action-button"
                title="截取视频最后一帧为图片节点"
                data-tooltip="截尾帧"
                onClick={(event) => {
                  event.stopPropagation();
                  onExtractVideoFrame?.(node.id, displayVideo, 'last');
                }}
              >
                <ImageIcon size={13} />
                <span>截尾帧</span>
              </button>
              <button
                type="button"
                className="image-output-action-button"
                title="剪辑视频片段"
                data-tooltip="剪辑"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsClipping(true);
                  videoRef.current?.pause();
                }}
              >
                <Scissors size={13} />
                <span>剪辑</span>
              </button>
              <button
                type="button"
                className="image-output-action-button"
                title="分离视频为音频节点和无声画面节点"
                data-tooltip={isExtractingAudio ? '分离中' : '分离音视频'}
                disabled={isExtractingAudio}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                }}
                onClick={handleExtractAudio}
              >
                {isExtractingAudio ? <LoaderCircle size={13} className="spin" /> : <Headphones size={13} />}
                <span>{isExtractingAudio ? '分离中' : '分离音视频'}</span>
              </button>
            </div>
          )}

          {isExtractingAudio ? (
            <div className="video-audio-extract-overlay" onPointerDown={(event) => event.stopPropagation()}>
              <LoaderCircle size={18} className="spin-icon" />
              <span>正在分离音频和画面…</span>
            </div>
          ) : null}

          {isClipping && (
            <div className="video-clip-overlay" onPointerDown={(e) => e.stopPropagation()}>
              <button className="video-clip-btn cancel" onClick={() => setIsClipping(false)} title="取消">
                <X size={14} />
              </button>
              
              <div className="video-clip-timeline-wrapper">
                <div className="video-clip-timeline-frames">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const duration = videoDuration || 10;
                    const t = (i + 0.5) * (duration / 8);
                    return (
                      <div key={i} className="video-clip-frame-thumb">
                        <video
                          src={`${normalizeVideoUrl(displayVideo)}#t=${t.toFixed(2)}`}
                          preload="metadata"
                          muted
                          playsInline
                        />
                      </div>
                    );
                  })}
                </div>

                <div 
                  className="video-clip-timeline-mask left-mask"
                  style={{ width: `${(clipStart / (videoDuration || 10)) * 100}%` }}
                />
                <div 
                  className="video-clip-timeline-mask right-mask"
                  style={{ left: `${(clipEnd / (videoDuration || 10)) * 100}%`, right: 0 }}
                />

                <div className="video-clip-timeline-track" ref={trackRef}>
                  <div 
                    className="video-clip-timeline-selection"
                    style={{
                      left: `${(clipStart / (videoDuration || 10)) * 100}%`,
                      width: `${((clipEnd - clipStart) / (videoDuration || 10)) * 100}%`
                    }}
                  />
                  
                  <div 
                    className="video-clip-handle left-handle" 
                    style={{ left: `${(clipStart / (videoDuration || 10)) * 100}%` }}
                    onPointerDown={(e) => handlePointerDown(e, 'start')}
                  >
                    <div className="handle-bar" />
                  </div>
                  
                  <div 
                    className="video-clip-handle right-handle" 
                    style={{ left: `${(clipEnd / (videoDuration || 10)) * 100}%` }}
                    onPointerDown={(e) => handlePointerDown(e, 'end')}
                  >
                    <div className="handle-bar" />
                  </div>

                  <div className="video-clip-duration-badge">
                    {(clipEnd - clipStart).toFixed(1)}s
                  </div>
                </div>
              </div>
              
              <button className="video-clip-btn confirm" onClick={handleConfirmClip} title="确定">
                <Check size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="image-empty">
          <span>输入提示词生成视频</span>
        </div>
      )}
    </div>
  );
}

function getAudioDisplayUrl(node) {
  const audioUrl = String(node.audioUrl || '').trim();
  if (audioUrl) return audioUrl;
  const content = String(node.content || '').trim();
  if (content && isAudioContent(content)) return content;
  return '';
}

function getAudioDisplayName(url, fallbackTitle = '音频') {
  const value = String(url || '').trim();
  if (!value) return fallbackTitle;
  if (value.startsWith('data:')) return '本地 MP3';

  try {
    const normalized = normalizeAudioUrl(value);
    const pathname = normalized.startsWith('http')
      ? new URL(normalized).pathname
      : normalized.split('?')[0];
    const filename = decodeURIComponent(pathname.split('/').pop() || '').trim();
    if (filename) return filename;
  } catch {
    const tail = value.split('/').pop()?.split('?')[0];
    if (tail) return decodeURIComponent(tail);
  }

  return fallbackTitle;
}

function AudioWaveform({ active = false }) {
  return (
    <div className={`audio-waveform ${active ? 'is-active' : ''}`} aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <span
          key={index}
          className="audio-waveform-bar"
          style={{ '--bar-delay': `${index * 0.08}s` }}
        />
      ))}
    </div>
  );
}

function AudioPlayerCard({ src, title }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  return (
    <div className={`audio-player-card ${isPlaying ? 'is-playing' : ''}`}>
      <div className="audio-player-card-glow" aria-hidden="true" />
      <div className="audio-player-card-header">
        <div className="audio-player-icon">
          <Headphones size={18} />
        </div>
        <div className="audio-player-meta">
          <div className="audio-player-title-row">
            <span className="audio-player-title" title={title}>
              {title}
            </span>
            <span className="audio-player-badge">MP3</span>
          </div>
        </div>
      </div>
      <AudioWaveform active={isPlaying} />
      <div
        className="audio-player-controls"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <audio ref={audioRef} controls preload="metadata" src={src} />
      </div>
    </div>
  );
}

function AudioBody({
  node,
  isRunning,
  showOutputActions = false,
  isInputsHighlighted = false,
  onBeginDrag,
  onHighlightInputs,
  onOpenAssetLibrary,
  onUploadAudioOutput,
  onSyncAudioLayout,
}) {
  const displayAudio = getAudioDisplayUrl(node);
  const outputFileInputRef = useRef(null);

  useEffect(() => {
    if (!onSyncAudioLayout) return undefined;

    const minHeight = displayAudio
      ? MIN_AUDIO_NODE_HEIGHT_WITH_CONTENT
      : MIN_AUDIO_NODE_HEIGHT;
    const minWidth = DEFAULT_AUDIO_NODE_WIDTH;
    const nextHeight = Math.max(Number(node.height) || 0, minHeight);
    const nextWidth = Math.max(Number(node.width) || 0, minWidth);

    if (nextHeight !== node.height || nextWidth !== node.width) {
      onSyncAudioLayout(node.id, { height: nextHeight, width: nextWidth });
    }

    return undefined;
  }, [displayAudio, node.id, node.height, node.width, onSyncAudioLayout]);

  if (isRunning) {
    return (
      <NodeGenerationState
        node={node}
        kind="audio"
        label="正在合成语音"
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
        <strong>操作失败</strong>
        <span>{node.content || '音频处理失败'}</span>
      </div>
    );
  }

  return (
    <div
      className={`audio-output-preview ${isInputsHighlighted ? 'inputs-highlighted' : ''}`}
      onPointerDown={(event) => {
        onHighlightInputs?.(node.id);
        onBeginDrag(event, node);
      }}
    >
      {showOutputActions && (onOpenAssetLibrary || onUploadAudioOutput) ? (
        <div
          className="image-output-actions"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {onUploadAudioOutput ? (
            <>
              <button
                type="button"
                className="image-output-action-button"
                title="上传本地音频"
                onClick={(event) => {
                  event.stopPropagation();
                  outputFileInputRef.current?.click();
                }}
              >
                <Upload size={12} />
                <span>上传</span>
              </button>
              <input
                ref={outputFileInputRef}
                type="file"
                accept={AUDIO_FILE_ACCEPT}
                hidden
                onChange={(event) => {
                  const files = filterAudioFiles(event.target.files || []);
                  if (files.length > 0) {
                    onUploadAudioOutput(node.id, files);
                  }
                  event.target.value = '';
                }}
              />
            </>
          ) : null}
          {onOpenAssetLibrary ? (
            <button
              type="button"
              className="image-output-action-button"
              title="从资产库选择音频"
              onClick={(event) => {
                event.stopPropagation();
                onOpenAssetLibrary(node.id, 'audio-output');
              }}
            >
              <FolderOpen size={12} />
              <span>资产库</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {displayAudio ? (
        <div className="audio-player-shell">
          <AudioPlayerCard
            src={normalizeAudioUrl(displayAudio)}
            title={getAudioDisplayName(displayAudio, node.title || '音频')}
          />
        </div>
      ) : (
        <div className="audio-empty-state">
          <div className="audio-empty-icon">
            <Headphones size={22} aria-hidden="true" />
          </div>
          <strong>添加音频</strong>
          <span>上传 MP3 或从资产库选择，也可在下方合成</span>
        </div>
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
  const preview = image.previewUrl || image.preview;
  if (preview) return preview;
  const value = image.url || image.data;
  if (!value || String(value).startsWith('asset://')) return '';
  return image.source === 'local' ? value : normalizeImageUrl(value);
}

function getReferencePreviewUrls(references, resolvePreviewUrl = referencePreviewSrc) {
  return references.map((image) => resolvePreviewUrl(image)).filter(Boolean);
}

function useSeedancePreviewSrc(item, mediaType) {
  const direct = resolveSeedanceMediaPreviewUrl(item, mediaType);
  const assetUrl = String(item?.url || '').trim();
  const assetId =
    item?.assetId || (assetUrl.startsWith('asset://') ? assetUrl.slice('asset://'.length) : '');
  const needsFetch = !direct && Boolean(assetId);

  const [src, setSrc] = useState(direct);
  const [loading, setLoading] = useState(needsFetch);

  useEffect(() => {
    const resolved = resolveSeedanceMediaPreviewUrl(item, mediaType);
    if (resolved) {
      setSrc(resolved);
      setLoading(false);
      return undefined;
    }

    if (!assetId) {
      setSrc('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      const token = getStoredChatToken();
      if (!token) {
        if (!cancelled) {
          setSrc('');
          setLoading(false);
        }
        return;
      }
      try {
        const result = await getSd2ManxueAssetList({
          token,
          mediaType,
          pageSize: 100,
          status: 'Active',
        });
        if (cancelled) return;
        const found = result.list.find((row) => row.assetId === assetId || row.id === assetId);
        setSrc(found ? resolveSeedanceMediaPreviewUrl(found, mediaType) : '');
      } catch {
        if (!cancelled) setSrc('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item, mediaType, assetId]);

  return { src, loading };
}

function SeedanceMediaPanel({
  label,
  icon: Icon,
  mediaType,
  items,
  maxCount,
  disabled,
  disabledHint,
  isRunning,
  onPick,
  onRemove,
}) {
  const isBlocked = Boolean(disabled && disabledHint);
  return (
    <div className={`seedance-media-panel ${isBlocked ? 'is-blocked' : ''}`}>
      <div className="seedance-media-panel-header">
        <Icon size={13} />
        <span className="seedance-media-panel-title">{label}</span>
        <span className="seedance-optional-tag">可选</span>
        <span className="seedance-media-count">{items.length}/{maxCount}</span>
        <button
          type="button"
          className="seedance-pick-btn"
          onClick={onPick}
          disabled={isRunning || disabled || items.length >= maxCount}
          title={
            disabledHint ||
            (items.length >= maxCount ? `最多 ${maxCount} 个` : `从满血版素材库选择${label}`)
          }
        >
          <FolderOpen size={12} />
          素材库
        </button>
      </div>
      {items.length > 0 ? (
        <div className={`seedance-media-preview-list ${mediaType === 'audio' ? 'is-audio' : ''}`}>
          {items.map((item, index) => (
            <SeedanceMediaPreviewCard
              key={item.id || item.url || index}
              item={item}
              mediaType={mediaType}
              label={label}
              index={index}
              icon={Icon}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
      ) : (
        <div className="seedance-media-empty">暂未选择</div>
      )}
      {isBlocked ? <p className="seedance-media-hint">{disabledHint}</p> : null}
    </div>
  );
}

function SeedanceMediaPreviewCard({ item, mediaType, label, index, icon: Icon, onRemove }) {
  const { src: previewUrl, loading } = useSeedancePreviewSrc(item, mediaType);

  return (
    <div className="seedance-media-preview-item">
      {mediaType === 'video' && previewUrl ? (
        <video src={previewUrl} controls playsInline preload="metadata" />
      ) : mediaType === 'audio' && previewUrl ? (
        <audio src={previewUrl} controls preload="metadata" />
      ) : (
        <div className="seedance-media-preview-fallback">
          <Icon size={18} />
          <span>{loading ? '加载预览…' : '无法预览'}</span>
        </div>
      )}
      <span className="seedance-media-name" title={item.name || `${label} ${index + 1}`}>
        {item.name || `${label} ${index + 1}`}
      </span>
      <button type="button" className="seedance-media-remove" onClick={onRemove} title={`移除${label}`}>
        <X size={11} />
      </button>
    </div>
  );
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

export function VideoToolbar({
  node,
  variant = 'dock',
  isRunning,
  isTranslating,
  textInputLinks = [],
  imageInputLinks = [],
  videoInputLinks = [],
  onRunVideoGeneration,
  onOpenAssetLibrary,
  onRemoveImageReference,
  onRemoveTextReference,
  onRemoveVeoFrame,
  onRemoveSeedanceMedia,
  onUpdateNode,
  onOpenEnlargedSettings,
  onVideoGenerationTypeChange,
  onPreviewImage,
  pricingList,
  userProfile,
}) {
  const toolbarRef = useRef(null);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!showSettingsPopover) return;
    const handleOutsideClick = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowSettingsPopover(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [showSettingsPopover]);
  const hasTextInput = textInputLinks.length > 0;
  const isPromptEmpty = !String(node.prompt || '').trim() && !hasTextInput;
  const resolvedReferences = resolveVideoToolbarReferences(node, imageInputLinks);
  const assetReferences = Array.isArray(node.referenceImages) ? node.referenceImages : [];
  const {
    firstFrame: resolvedFirstFrame,
    lastFrame: resolvedLastFrame,
    firstConnectionLinkId,
    lastConnectionLinkId,
  } = resolveVideoToolbarFrames(node, imageInputLinks);
  const referenceVideos = Array.isArray(node.videoReferenceVideos) ? node.videoReferenceVideos : [];
  const referenceAudios = Array.isArray(node.videoReferenceAudios) ? node.videoReferenceAudios : [];
  const family = inferVideoFamily(node);
  const isVeo = family === 'veo';
  const isSeedance = family === 'seedance';
  const veoGenerationType = node.videoGenerationType || 'frame';
  const showVeoReferenceImages = isVeo && veoGenerationType === 'reference';
  const seedanceReferenceMode = isSeedance && assetReferences.length > 0;
  const showSeedanceReferenceImages = seedanceReferenceMode;
  const showSeedanceFrames = isSeedance && !seedanceReferenceMode;
  const hasSeedanceFrames = showSeedanceFrames && Boolean(resolvedFirstFrame || resolvedLastFrame);
  const hasSeedanceReferenceImages = seedanceReferenceMode && resolvedReferences.length > 0;
  const showSeedanceReferenceMedia = isSeedance && !hasSeedanceFrames;
  const showGenericReferenceImages = !isVeo && !isSeedance;
  const model = node.videoModel || getVideoModelOptions(family)[0]?.value;
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
  const genericReferenceMax = getVideoReferenceImageMax(node);
  const referencePreviewUrls = getReferencePreviewUrls(resolvedReferences);
  const hasVideoRefs = videoInputLinks.length > 0;
  const videoCost = pricingList ? calculateEstimatedCost(pricingList, node, userProfile, { hasVideoRefs }) : 0;

  function previewReferenceAt(index) {
    const targetUrl = referencePreviewSrc(resolvedReferences[index]);
    if (!targetUrl || !onPreviewImage) return;
    const activeIndex = referencePreviewUrls.indexOf(targetUrl);
    onPreviewImage(referencePreviewUrls, activeIndex >= 0 ? activeIndex : 0);
  }

  useEffect(() => {
    if (variant === 'modal' || !isSeedance) return undefined;

    const toolbar = toolbarRef.current;
    if (!toolbar) return undefined;

    let animationFrame = 0;

    const updateSeedanceViewport = () => {
      toolbar.style.setProperty('--seedance-toolbar-offset-y', '0px');

      const rect = toolbar.getBoundingClientRect();
      const stage = toolbar.closest('.stage');
      const scale = Number.parseFloat(getComputedStyle(stage || document.documentElement).getPropertyValue('--canvas-scale')) || 1;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const gap = 12;
      const naturalTop = rect.top;
      const naturalAvailable = viewportHeight - naturalTop - gap;
      const desiredHeight = Math.min(toolbar.scrollHeight * scale, Math.max(280, viewportHeight - gap * 2));
      const maxOffset = Math.max(0, naturalTop - gap);
      const offset = Math.min(Math.max(0, desiredHeight - naturalAvailable), maxOffset);
      const visibleHeight = Math.max(280, viewportHeight - (naturalTop - offset) - gap);
      const nextMaxHeight = `${Math.round(visibleHeight / scale)}px`;
      const nextOffset = `${Math.round(-(offset / scale))}px`;

      if (toolbar.style.getPropertyValue('--seedance-toolbar-max-height') !== nextMaxHeight) {
        toolbar.style.setProperty('--seedance-toolbar-max-height', nextMaxHeight);
      }
      if (toolbar.style.getPropertyValue('--seedance-toolbar-offset-y') !== nextOffset) {
        toolbar.style.setProperty('--seedance-toolbar-offset-y', nextOffset);
      }
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updateSeedanceViewport);
    };

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    window.visualViewport?.addEventListener('resize', scheduleUpdate);

    const stage = toolbar.closest('.stage');
    const mutationObserver =
      typeof MutationObserver !== 'undefined' && stage
        ? new MutationObserver(scheduleUpdate)
        : null;
    mutationObserver?.observe(stage, { attributes: true, attributeFilter: ['style', 'class'] });

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
      mutationObserver?.disconnect();
      toolbar.style.removeProperty('--seedance-toolbar-max-height');
      toolbar.style.removeProperty('--seedance-toolbar-offset-y');
    };
  }, [
    variant,
    isSeedance,
    node.id,
    resolvedReferences.length,
    referenceVideos.length,
    referenceAudios.length,
    hasSeedanceFrames,
    hasSeedanceReferenceImages,
  ]);

  function patchVideoLayout(overrides = {}) {
    return buildVideoNodeLayoutPatch({ ...node, ...overrides });
  }

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
    }

    if (nextFamily !== 'veo' && nextFamily !== 'seedance') {
      patch.videoFirstFrame = null;
      patch.videoLastFrame = null;
    }

    if (nextFamily !== 'seedance') {
      patch.videoReferenceVideos = [];
      patch.videoReferenceAudios = [];
    }

    onUpdateNode(node.id, {
      ...patch,
      ...patchVideoLayout({
        videoFamily: patch.videoFamily,
        videoOrientation: patch.videoOrientation,
        videoRatio: patch.videoRatio,
        videoSize: patch.videoSize,
      }),
    });
  }

  function applyVeoGenerationTypeChange(value) {
    if (onVideoGenerationTypeChange) {
      onVideoGenerationTypeChange(node.id, value);
      return;
    }
    const patch = { videoGenerationType: value, status: 'idle' };
    if (value === 'frame') {
      patch.referenceImages = [];
    } else {
      patch.videoFirstFrame = null;
      patch.videoLastFrame = null;
    }
    onUpdateNode(node.id, patch);
  }

  function removeVideoReferenceAt(index) {
    const image = resolvedReferences[index];
    if (!image) return;
    if (image.source === 'connection' && image.linkId) {
      onRemoveTextReference(image.linkId);
      return;
    }
    const assetIndex = assetReferences.findIndex(
      (item) =>
        (image.id && item.id === image.id) ||
        (image.url && (item.url === image.url || item.data === image.url))
    );
    if (assetIndex >= 0) {
      onRemoveImageReference(node.id, assetIndex);
    }
  }

  function clearResolvedFirstFrame() {
    if (firstConnectionLinkId) {
      onRemoveTextReference(firstConnectionLinkId);
      return;
    }
    onRemoveVeoFrame(node.id, 'first');
  }

  function clearResolvedLastFrame() {
    if (lastConnectionLinkId) {
      onRemoveTextReference(lastConnectionLinkId);
      return;
    }
    onRemoveVeoFrame(node.id, 'last');
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
      ...patchVideoLayout({
        videoOrientation: nextSettings.orientation,
        videoRatio: nextSettings.ratio,
        videoSize: nextSettings.size,
      }),
    });
  }

  const showResolutionControl = resolutionOptions.length > 0;
  const shareRatioDurationRow = ratioOptions.length <= 3 && durationOptions.length <= 3;

  const ratioSegment = (
    <OptionSegment
      title="宽高比"
      value={ratioValue}
      options={ratioOptions}
      onChange={(value) => {
        if (family === 'sora') {
          const size = defaultSoraSize(value);
          onUpdateNode(node.id, {
            videoOrientation: value,
            videoSize: size,
            ...patchVideoLayout({ videoOrientation: value, videoSize: size }),
          });
          return;
        }
        onUpdateNode(node.id, {
          videoRatio: value,
          ...patchVideoLayout({ videoRatio: value }),
        });
      }}
      renderIcon={(option) => <RatioIcon value={ratioIconValue(family, option.value)} />}
    />
  );

  const durationSegment = (
    <OptionSegment
      title="时长"
      value={normalizedSettings.duration}
      options={durationOptions}
      onChange={(value) => onUpdateNode(node.id, { videoDuration: value })}
    />
  );

  const videoSettingsPanels = (
    <div className="settings-options-stack">
      <OptionSegment
        title="系列"
        value={family}
        options={VIDEO_FAMILY_OPTIONS}
        onChange={applyFamilyChange}
      />
      <div className="settings-options-row">
        {modelOptions.length > 1 ? (
          <OptionSegment
            title="模型"
            value={normalizedSettings.model}
            options={modelOptions}
            onChange={applyModelChange}
          />
        ) : isSeedance ? (
          <div className="option-segment video-model-fixed" title="Seedance 2.0 满血版">
            <span className="option-segment-title">模型</span>
            <div className="video-model-fixed-panel">
              <span className="video-model-fixed-badge">满血版</span>
              <span className="video-model-fixed-value">Seedance 2.0</span>
            </div>
          </div>
        ) : null}
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
        <OptionSegment
          title="生成次数"
          value={normalizedSettings.count}
          options={countOptions.map((option) => ({ ...option, label: `${option.value}次` }))}
          onChange={(value) => onUpdateNode(node.id, { videoCount: Number(value) })}
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
      {shareRatioDurationRow ? (
        <div className="settings-options-row">
          {ratioSegment}
          {durationSegment}
        </div>
      ) : (
        <>
          {ratioSegment}
          {durationSegment}
        </>
      )}
    </div>
  );

  if (variant === 'modal') {
    return (
      <div
        ref={toolbarRef}
        className={`node-bottom-toolbar image-toolbar video-toolbar ${isSeedance ? 'video-toolbar-seedance' : ''} node-settings-toolbar-modal`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="modal-two-columns">
          <div className="modal-left-column">
            {showVeoReferenceImages || showSeedanceReferenceImages || showGenericReferenceImages ? (
              <div
                className={`image-reference-row image-reference-row-top ${showSeedanceReferenceImages ? 'seedance-reference-row' : ''}`}
              >
                <span className="image-reference-label">
                  {showSeedanceReferenceImages ? '参考图（满血版素材库）' : '参考图'}
                </span>
                <div className="image-reference-list">
                  {resolvedReferences.map((image, index) => (
                    <ReferenceImageChip
                      key={image.id || image.url || index}
                      image={image}
                      index={index}
                      previewSrc={referencePreviewSrc(image)}
                      onPreview={
                        onPreviewImage && referencePreviewSrc(image)
                          ? () => previewReferenceAt(index)
                          : undefined
                      }
                      onRemove={() => removeVideoReferenceAt(index)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="prompt-asset-button prompt-asset-button--inline"
                  onClick={() =>
                    onOpenAssetLibrary(
                      node.id,
                      showVeoReferenceImages
                        ? 'veo-reference'
                        : showSeedanceReferenceImages
                          ? 'seedance-reference'
                          : 'reference'
                    )
                  }
                  disabled={
                    isRunning ||
                    (showVeoReferenceImages && resolvedReferences.length >= VEO_REFERENCE_IMAGE_MAX) ||
                    (showSeedanceReferenceImages && resolvedReferences.length >= SEEDANCE_REF_IMAGE_MAX) ||
                    (showGenericReferenceImages && resolvedReferences.length >= genericReferenceMax)
                  }
                  title={
                    showVeoReferenceImages
                      ? `从资产库选择参考图（最多 ${VEO_REFERENCE_IMAGE_MAX} 张）`
                      : showSeedanceReferenceImages
                        ? `从满血版素材库选择参考图（最多 ${SEEDANCE_REF_IMAGE_MAX} 张）`
                        : `从资产库选择参考图（最多 ${genericReferenceMax} 张）`
                  }
                >
                  <FolderOpen size={14} />
                  资产库
                </button>
              </div>
            ) : null}
            {showVeoReferenceImages || showSeedanceReferenceImages || showGenericReferenceImages ? (
              <ReferencePromptInput
                value={node.prompt || ''}
                onChange={(prompt) => onUpdateNode(node.id, { prompt, status: 'idle' })}
                references={resolvedReferences}
                resolvePreviewUrl={(image) => referencePreviewSrc(image)}
                placeholder="输入视频提示词"
                disabled={isRunning}
              />
            ) : (
              <div className="node-prompt-wrap node-prompt-wrap--plain">
                <textarea
                  className="node-prompt-input"
                  value={node.prompt || ''}
                  onChange={(event) => onUpdateNode(node.id, { prompt: event.target.value, status: 'idle' })}
                  placeholder="输入视频提示词"
                />
              </div>
            )}
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
          </div>
          <div className="modal-right-column">
            {videoSettingsPanels}
            {isVeo && veoGenerationType === 'frame' ? (
              <div className="veo-frame-row">
                <VeoFrameSlot
                  label="首帧"
                  image={resolvedFirstFrame}
                  disabled={isRunning}
                  onPick={() => onOpenAssetLibrary(node.id, 'veo-first')}
                  onClear={clearResolvedFirstFrame}
                />
                <VeoFrameSlot
                  label="尾帧"
                  optional
                  image={resolvedLastFrame}
                  disabled={isRunning || !resolvedFirstFrame}
                  blockedHint={!resolvedFirstFrame ? '请先选择首帧' : ''}
                  onPick={() => {
                    if (!resolvedFirstFrame) return;
                    onOpenAssetLibrary(node.id, 'veo-last');
                  }}
                  onClear={clearResolvedLastFrame}
                />
              </div>
            ) : null}
            {isSeedance ? (
              <p className="video-manxue-hint">
                参考图与首尾帧互斥；已选首尾帧时不可添加参考视频/音频。素材需从满血版素材库选择。
              </p>
            ) : null}
            {showSeedanceFrames ? (
              <div className="seedance-section">
                <div className="seedance-section-title">首尾帧</div>
                <div className="veo-frame-row seedance-frame-row">
                  <VeoFrameSlot
                    label="首帧"
                    image={resolvedFirstFrame}
                    disabled={isRunning}
                    onPick={() => onOpenAssetLibrary(node.id, 'seedance-first')}
                    onClear={clearResolvedFirstFrame}
                  />
                  <VeoFrameSlot
                    label="尾帧"
                    optional
                    image={resolvedLastFrame}
                    disabled={isRunning || !resolvedFirstFrame}
                    blockedHint={!resolvedFirstFrame ? '请先选择首帧' : ''}
                    onPick={() => {
                      if (!resolvedFirstFrame) return;
                      onOpenAssetLibrary(node.id, 'seedance-last');
                    }}
                    onClear={clearResolvedLastFrame}
                  />
                </div>
              </div>
            ) : null}

            <div className="node-bottom-actions image-bottom-actions">
              {pricingList && (
                <span className="estimated-cost-hint">
                  预估消耗: <JimicoinIcon size={14} /> {videoCost.toFixed(4)}
                </span>
              )}
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
        </div>
      </div>
    );
  }

  const durationLabel = node.videoDuration ? `${node.videoDuration}s` : '';
  const summaryParts = [
    durationLabel,
    ratioValue,
    resolutionValue
  ].filter(Boolean);
  const summaryText = summaryParts.join(' | ') || '设置';

  const settingsContent = videoSettingsPanels;


  const showRefImageBtn = showVeoReferenceImages || showGenericReferenceImages;
  const maxRefImageCount = showVeoReferenceImages ? VEO_REFERENCE_IMAGE_MAX : genericReferenceMax;

  const extraActions = (
    <>
      {showRefImageBtn && (
        <button
          type="button"
          className="prompt-asset-button"
          onClick={() =>
            onOpenAssetLibrary(
              node.id,
              showVeoReferenceImages ? 'veo-reference' : 'reference'
            )
          }
          disabled={
            isRunning ||
            (showVeoReferenceImages && resolvedReferences.length >= VEO_REFERENCE_IMAGE_MAX) ||
            (showGenericReferenceImages && resolvedReferences.length >= genericReferenceMax)
          }
          title={
            showVeoReferenceImages
              ? `从资产库选择参考图（最多 ${VEO_REFERENCE_IMAGE_MAX} 张）`
              : `从资产库选择参考图（最多 ${genericReferenceMax} 张）`
          }
        >
          <FolderOpen size={14} />
        </button>
      )}
      {variant === 'dock' && onOpenEnlargedSettings ? (
        <NodeEnlargeButton title="放大编辑设置" onClick={onOpenEnlargedSettings} />
      ) : null}
    </>
  );

  return (
    <div
      ref={toolbarRef}
      className={`node-bottom-toolbar image-toolbar video-toolbar ${isSeedance ? 'video-toolbar-seedance' : ''} ${variant === 'modal' ? 'node-settings-toolbar-modal' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {variant === 'dock' ? (
        resolvedReferences.length > 0 && !isSeedance ? (
          <div className="image-reference-row image-reference-row-top image-reference-row-chips-only">
            <div className="image-reference-list">
              {resolvedReferences.map((image, index) => {
                const isConnection = image.source === 'connection';
                const assetIndex = isConnection
                  ? -1
                  : assetReferences.findIndex((ref) => ref.id === image.id);

                return (
                  <ReferenceImageChip
                    key={image.id || image.url || index}
                    image={image}
                    index={index}
                    previewSrc={referencePreviewSrc(image)}
                    onPreview={() => previewReferenceAt(index)}
                    onRemove={() => {
                      if (isConnection) {
                        onRemoveImageReference(image.linkId);
                      } else if (assetIndex >= 0) {
                        const nextRefs = [...assetReferences];
                        nextRefs.splice(assetIndex, 1);
                        onUpdateNode(node.id, { referenceImages: nextRefs });
                      }
                    }}
                    removeTitle={isConnection ? '移除图片引用并断开连线' : '移除参考图'}
                  />
                );
              })}
            </div>
          </div>
        ) : isSeedance ? (
          <>
            {showSeedanceFrames ? (
              <div className="seedance-above-prompt">
                <div className="seedance-above-row">
                  <VeoFrameSlot
                    label="首帧"
                    image={resolvedFirstFrame}
                    disabled={isRunning}
                    onPick={() => onOpenAssetLibrary(node.id, 'seedance-first')}
                    onClear={clearResolvedFirstFrame}
                  />
                  <VeoFrameSlot
                    label="尾帧"
                    optional
                    image={resolvedLastFrame}
                    disabled={isRunning || !resolvedFirstFrame}
                    blockedHint={!resolvedFirstFrame ? '请先选择首帧' : ''}
                    onPick={() => {
                      if (!resolvedFirstFrame) return;
                      onOpenAssetLibrary(node.id, 'seedance-last');
                    }}
                    onClear={clearResolvedLastFrame}
                  />
                </div>
              </div>
            ) : null}

            {seedanceReferenceMode ? (
              <div className="seedance-above-prompt">
                <div className="seedance-above-row">
                  <VeoFrameSlot
                    label="参考图"
                    image={resolvedReferences[0]}
                    disabled={isRunning}
                    onPick={() => onOpenAssetLibrary(node.id, 'seedance-reference')}
                    onClear={() => onUpdateNode(node.id, { referenceImages: [] })}
                  />
                </div>
              </div>
            ) : (
              <div className="seedance-above-prompt">
                <div className="seedance-above-row">
                  <VeoFrameSlot
                    label="参考图"
                    image={undefined}
                    disabled={isRunning}
                    onPick={() => onOpenAssetLibrary(node.id, 'seedance-reference')}
                    onClear={() => {}}
                  />
                </div>
              </div>
            )}
          </>
        ) : null
      ) : (
        isSeedance ? (
          <div className="seedance-section seedance-first-frame-select">
            <div className="seedance-section-title">参考图</div>
            <VeoFrameSlot
              label="参考图"
              image={resolvedReferences[0]}
              disabled={isRunning}
              onPick={() => onOpenAssetLibrary(node.id, 'seedance-reference')}
              onClear={() => onUpdateNode(node.id, { referenceImages: [] })}
            />
          </div>
        ) : showGenericReferenceImages ? (
          <div className="image-reference-row image-reference-row-top">
            <span className="image-reference-label">参考图</span>
            <div className="image-reference-list">
              {resolvedReferences.map((image, index) => {
                const isConnection = image.source === 'connection';
                const assetIndex = isConnection
                  ? -1
                  : assetReferences.findIndex((ref) => ref.id === image.id);

                return (
                  <ReferenceImageChip
                    key={image.id || image.url || index}
                    image={image}
                    index={index}
                    previewSrc={referencePreviewSrc(image)}
                    onPreview={() => previewReferenceAt(index)}
                    onRemove={() => {
                      if (isConnection) {
                        onRemoveImageReference(image.linkId);
                      } else if (assetIndex >= 0) {
                        const nextRefs = [...assetReferences];
                        nextRefs.splice(assetIndex, 1);
                        onUpdateNode(node.id, { referenceImages: nextRefs });
                      }
                    }}
                    removeTitle={isConnection ? '移除图片引用并断开连线' : '移除参考图'}
                  />
                );
              })}
            </div>
            <button
              type="button"
              className="prompt-asset-button prompt-asset-button--inline"
              onClick={() => onOpenAssetLibrary(node.id, 'reference')}
              disabled={isRunning || resolvedReferences.length >= genericReferenceMax}
              title={`从资产库选择参考图（最多 ${genericReferenceMax} 张，支持多选）`}
            >
              <FolderOpen size={14} />
              参考图
            </button>
          </div>
        ) : showVeoReferenceImages ? (
          <div className="image-reference-row image-reference-row-top">
            <span className="image-reference-label">参考图</span>
            <div className="image-reference-list">
              {resolvedReferences.map((image, index) => {
                const isConnection = image.source === 'connection';
                const assetIndex = isConnection
                  ? -1
                  : assetReferences.findIndex((ref) => ref.id === image.id);

                return (
                  <ReferenceImageChip
                    key={image.id || image.url || index}
                    image={image}
                    index={index}
                    previewSrc={referencePreviewSrc(image)}
                    onPreview={() => previewReferenceAt(index)}
                    onRemove={() => {
                      if (isConnection) {
                        onRemoveImageReference(image.linkId);
                      } else if (assetIndex >= 0) {
                        const nextRefs = [...assetReferences];
                        nextRefs.splice(assetIndex, 1);
                        onUpdateNode(node.id, { referenceImages: nextRefs });
                      }
                    }}
                    removeTitle={isConnection ? '移除图片引用并断开连线' : '移除参考图'}
                  />
                );
              })}
            </div>
            <button
              type="button"
              className="prompt-asset-button prompt-asset-button--inline"
              onClick={() => onOpenAssetLibrary(node.id, 'reference')}
              disabled={isRunning || resolvedReferences.length >= VEO_REFERENCE_IMAGE_MAX}
              title={`从资产库选择参考图（最多 ${VEO_REFERENCE_IMAGE_MAX} 张，支持多选）`}
            >
              <FolderOpen size={14} />
              参考图
            </button>
          </div>
        ) : null
      )}
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
      {family !== 'seedance' && family !== 'sora' ? (
        <ReferencePromptInput
          value={node.prompt || ''}
          onChange={(prompt) => onUpdateNode(node.id, { prompt, status: 'idle' })}
          references={resolvedReferences}
          resolvePreviewUrl={referencePreviewSrc}
          placeholder="输入视频提示词，回车换行；支持 @ 引用参考图"
          disabled={isRunning}
          extraActions={extraActions}
        />
      ) : (
        <div className="node-prompt-wrap node-prompt-wrap--plain">
          <textarea
            className="node-prompt-input"
            value={node.prompt || ''}
            onChange={(event) => onUpdateNode(node.id, { prompt: event.target.value, status: 'idle' })}
            placeholder="输入视频提示词"
          />
          {extraActions && <div className="prompt-editor-actions">{extraActions}</div>}
        </div>
      )}

      {variant === 'modal' ? (
        settingsContent
      ) : isSeedance ? (
        showSettingsPopover && (
          <div className="toolbar-settings-inline" ref={popoverRef}>
            {settingsContent}
          </div>
        )
      ) : (
        showSettingsPopover && (
          <div className="toolbar-settings-popover" ref={popoverRef}>
            {settingsContent}
          </div>
        )
      )}

      {isVeo && veoGenerationType === 'frame' ? (
        <div className="veo-frame-row">
          <VeoFrameSlot
            label="首帧"
            image={resolvedFirstFrame}
            disabled={isRunning}
            onPick={() => onOpenAssetLibrary(node.id, 'veo-first')}
            onClear={clearResolvedFirstFrame}
          />
          <VeoFrameSlot
            label="尾帧"
            optional
            image={resolvedLastFrame}
            disabled={isRunning || !resolvedFirstFrame}
            blockedHint={!resolvedFirstFrame ? '请先选择首帧' : ''}
            onPick={() => {
              if (!resolvedFirstFrame) return;
              onOpenAssetLibrary(node.id, 'veo-last');
            }}
            onClear={clearResolvedLastFrame}
          />
        </div>
      ) : null}



      <div className="node-bottom-actions image-bottom-actions">
        {variant !== 'modal' && (
          <button
            type="button"
            className={`icon-button settings-trigger-btn ${showSettingsPopover ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowSettingsPopover(!showSettingsPopover);
            }}
            title="参数设置"
          >
            <Film size={14} />
            <span>{summaryText}</span>
          </button>
        )}

        {pricingList && (
          <span className="estimated-cost-hint">
            预估消耗: <JimicoinIcon size={14} /> {videoCost.toFixed(4)}
          </span>
        )}
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

export function ImageToolbar({
  node,
  variant = 'dock',
  isRunning,
  isTranslating,
  textInputLinks = [],
  imageInputLinks = [],
  onRunImageGeneration,
  onOpenAssetLibrary,
  onRemoveImageReference,
  onRemoveTextReference,
  onUpdateNode,
  onOpenEnlargedSettings,
  onPreviewImage,
  pricingList,
  userProfile,
}) {
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!showSettingsPopover) return;
    const handleOutsideClick = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowSettingsPopover(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [showSettingsPopover]);

  const hasTextInput = textInputLinks.length > 0;
  const isPromptEmpty = !String(node.prompt || '').trim() && !hasTextInput;
  const assetReferences = Array.isArray(node.referenceImages) ? node.referenceImages : [];
  const resolvedReferences = mergeImageReferenceImages(node, imageInputLinks);
  const model = node.imageModel || IMAGE_MODEL_OPTIONS[0].value;
  const maxReferenceCount = getImageReferenceMax(model);
  const resolutionOptions = getImageResolutionOptions(model);
  const ratioOptions = getImageRatioOptions(model);
  const countOptions = getImageCountOptions(model);
  const qualityOptions = getImageQualityOptions(model);
  const normalizedSettings = normalizeImageModelSettings({
    model,
    resolution: node.imageResolution,
    ratio: node.imageRatio,
    count: node.imageCount,
    quality: node.imageQuality,
  });
  const displayImages = getImageDisplayImages(node);
  const hasOutputImages = displayImages.length > 0;
  const referencePreviewUrls = getReferencePreviewUrls(resolvedReferences, referencePreviewSrc);
  const resolveImageReferencePreview = referencePreviewSrc;

  function previewReferenceAt(index) {
    const targetUrl = resolveImageReferencePreview(resolvedReferences[index]);
    if (!targetUrl || !onPreviewImage) return;
    const activeIndex = referencePreviewUrls.indexOf(targetUrl);
    onPreviewImage(referencePreviewUrls, activeIndex >= 0 ? activeIndex : 0);
  }

  function patchLayoutForEmptyNode(overrides = {}) {
    if (hasOutputImages) return {};
    return buildImageNodeLayoutPatch({
      imageRatio: overrides.imageRatio ?? node.imageRatio,
      imageCount: overrides.imageCount ?? node.imageCount,
    });
  }

  const modelLabel = model.replace(/^gpt-image-/, 'GPT-').toUpperCase();
  const summaryParts = [
    modelLabel,
    normalizedSettings.resolution,
    normalizedSettings.ratio,
    normalizedSettings.count ? `${normalizedSettings.count}张` : ''
  ].filter(Boolean);
  const summaryText = summaryParts.join(' | ') || '设置';

  const settingsContent = (
    <div className="settings-options-stack">
      <div className="settings-options-row">
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
              quality: node.imageQuality,
            });
            onUpdateNode(node.id, {
              imageModel: value,
              imageResolution: nextSettings.resolution,
              imageRatio: nextSettings.ratio,
              imageCount: nextSettings.count,
              imageQuality: nextSettings.quality,
              ...patchLayoutForEmptyNode({
                imageRatio: nextSettings.ratio,
                imageCount: nextSettings.count,
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
        {qualityOptions.length > 0 ? (
          <OptionSegment
            title="画质"
            value={normalizedSettings.quality}
            options={qualityOptions}
            onChange={(value) => onUpdateNode(node.id, { imageQuality: value, status: 'idle' })}
          />
        ) : null}
        <OptionSegment
          title="生成数量"
          value={normalizedSettings.count}
          options={countOptions.map((option) => ({ ...option, label: `${option.value}张` }))}
          onChange={(value) =>
            onUpdateNode(node.id, {
              imageCount: Number(value),
            })
          }
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
          })
        }
        renderIcon={(option) => <RatioIcon value={option.value} />}
      />
    </div>
  );

  const extraActions = (
    <>
      <button
        type="button"
        className="prompt-asset-button"
        onClick={() => onOpenAssetLibrary(node.id, 'reference')}
        disabled={isRunning || resolvedReferences.length >= maxReferenceCount}
        title={`从资产库选择参考图（最多 ${maxReferenceCount} 张，支持多选）`}
      >
        <FolderOpen size={14} />
      </button>
      {variant === 'dock' && onOpenEnlargedSettings ? (
        <NodeEnlargeButton title="放大编辑设置" onClick={onOpenEnlargedSettings} />
      ) : null}
    </>
  );

  return (
    <div
      className={`node-bottom-toolbar image-toolbar ${variant === 'modal' ? 'node-settings-toolbar-modal' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {resolvedReferences.length > 0 ? (
        <div className="image-reference-row image-reference-row-top image-reference-row-chips-only">
          <div className="image-reference-list">
            {resolvedReferences.map((image, index) => {
              const isConnection = image.source === 'connection';
              const assetIndex = isConnection
                ? -1
                : assetReferences.findIndex((ref) => ref.id === image.id);

              return (
                <ReferenceImageChip
                  key={image.id || image.url || index}
                  image={image}
                  index={index}
                  previewSrc={resolveImageReferencePreview(image)}
                  onPreview={() => previewReferenceAt(index)}
                  onRemove={() => {
                    if (isConnection) {
                      onRemoveImageReference(image.linkId);
                    } else if (assetIndex >= 0) {
                      const nextRefs = [...assetReferences];
                      nextRefs.splice(assetIndex, 1);
                      onUpdateNode(node.id, { referenceImages: nextRefs });
                    }
                  }}
                  removeTitle={isConnection ? '移除图片引用并断开连线' : '移除参考图'}
                />
              );
            })}
          </div>
        </div>
      ) : null}
      <ReferencePromptInput
        value={node.prompt || ''}
        onChange={(prompt) => onUpdateNode(node.id, { prompt, status: 'idle' })}
        references={resolvedReferences}
        resolvePreviewUrl={referencePreviewSrc}
        placeholder="输入图片提示词"
        disabled={isRunning}
        extraActions={extraActions}
      />

      {variant === 'modal' ? (
        settingsContent
      ) : (
        showSettingsPopover && (
          <div className="toolbar-settings-popover" ref={popoverRef}>
            {settingsContent}
          </div>
        )
      )}

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
      <div className="node-bottom-actions image-bottom-actions">
        {variant !== 'modal' && (
          <button
            type="button"
            className={`icon-button settings-trigger-btn ${showSettingsPopover ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowSettingsPopover(!showSettingsPopover);
            }}
            title="参数设置"
          >
            <Sparkles size={14} />
            <span>{summaryText}</span>
          </button>
        )}

        {pricingList && (
          <span className="estimated-cost-hint">
            预估消耗: <JimicoinIcon size={14} /> {calculateEstimatedCost(pricingList, node, userProfile).toFixed(4)}
          </span>
        )}
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

function AudioToolbar({
  node,
  isRunning,
  isTranslating,
  textInputLinks = [],
  onRunAudioGeneration,
  onRemoveTextReference,
  onUpdateNode,
  pricingList,
  userProfile,
}) {
  const hasTextInput = textInputLinks.length > 0;
  const isPromptEmpty = !String(node.prompt || '').trim() && !hasTextInput;

  return (
    <div className="node-bottom-toolbar audio-toolbar" onPointerDown={(event) => event.stopPropagation()}>
      <div className="node-prompt-wrap">
        <textarea
          className="node-prompt-input"
          value={node.prompt || ''}
          onChange={(event) => onUpdateNode(node.id, { prompt: event.target.value, status: 'idle' })}
          placeholder="输入要合成的文本"
        />
      </div>
      <div className="image-options-row audio-voice-row">
        <OptionSegment
          title="音色"
          value={node.audioVoice || 'alloy'}
          options={AUDIO_VOICE_OPTIONS}
          onChange={(value) => onUpdateNode(node.id, { audioVoice: value, status: 'idle' })}
        />
      </div>
      <OptionSegment
        title="语速"
        value={Number(node.audioSpeed) || 1}
        options={AUDIO_SPEED_OPTIONS}
        onChange={(value) => onUpdateNode(node.id, { audioSpeed: Number(value), status: 'idle' })}
      />
      <CustomSelect
        title="模型"
        icon={<Headphones size={14} />}
        value={node.audioModel || DEFAULT_AUDIO_MODEL}
        options={[{ value: DEFAULT_AUDIO_MODEL, label: DEFAULT_AUDIO_MODEL }]}
        onChange={() => {}}
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
      <div className="node-bottom-actions image-bottom-actions">
        {pricingList && (
          <span className="estimated-cost-hint">
            预估消耗: <JimicoinIcon size={14} /> {calculateEstimatedCost(pricingList, node, userProfile).toFixed(4)}
          </span>
        )}
        <button
          className="icon-button"
          onClick={() => onRunAudioGeneration(node, 'translate')}
          title="翻译文本"
          disabled={isTranslating || isRunning || isPromptEmpty}
        >
          {isTranslating ? <LoaderCircle size={14} className="spin-icon" /> : <Languages size={14} />}
          翻译
        </button>
        <button
          className="icon-button primary"
          onClick={() => onRunAudioGeneration(node)}
          title="运行语音合成"
          disabled={isRunning || isTranslating || isPromptEmpty}
        >
          {isRunning ? <LoaderCircle size={14} className="spin-icon" /> : <Play size={14} />}
          合成
        </button>
      </div>
    </div>
  );
}

function NoteToolbar({
  node,
  isRunning,
  isTranslating,
  imageInputLinks = [],
  videoInputLinks = [],
  onRunTextGeneration,
  onUpdateNode,
  onOpenTextEdit,
  onRemoveTextReference,
}) {
  const videoToPromptMode = isVideoToPromptNode(node, videoInputLinks);
  const imageToPromptMode = !videoToPromptMode && isImageToPromptNode(node, imageInputLinks);
  const reversePromptMode = videoToPromptMode || imageToPromptMode;
  const connectedVideos = resolveNoteVideoInputUrls(videoInputLinks);
  const connectedImages = resolveNoteImageInputUrls(imageInputLinks);
  const isPromptEmpty = !String(node.prompt || '').trim();
  const canRunReversePrompt =
    (videoToPromptMode && connectedVideos.length > 0) ||
    (imageToPromptMode && connectedImages.length > 0);
  const canRunText = !reversePromptMode && !isPromptEmpty;
  const hasReverseResult = Boolean(String(node.content || '').trim()) && node.status !== 'error';
  const canTranslateReverse = reversePromptMode && hasReverseResult;

  return (
    <div className="node-bottom-toolbar" onPointerDown={(event) => event.stopPropagation()}>
      {videoToPromptMode && videoInputLinks.length > 0 ? (
        <div className="image-reference-row">
          <span className="image-reference-label">视频引用</span>
          <div className="image-reference-list">
            {videoInputLinks.map(({ linkId, node: videoNode }) => {
              const previewUrl = getVideoNodeOutputUrl(videoNode);
              return (
                <div className="image-reference-chip connection-image-chip" key={linkId}>
                  {previewUrl ? (
                    <video
                      className="connection-video-thumb"
                      src={normalizeVideoUrl(previewUrl)}
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <div className="connection-image-placeholder">
                      <Film size={16} />
                    </div>
                  )}
                  <span className="connection-image-label" title={formatVideoInputLabel(videoNode)}>
                    {formatVideoInputLabel(videoNode)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveTextReference(linkId)}
                    title="移除视频引用并断开连线"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {imageToPromptMode && imageInputLinks.length > 0 ? (
        <div className="image-reference-row">
          <span className="image-reference-label">图片引用</span>
          <div className="image-reference-list">
            {imageInputLinks.map(({ linkId, node: imageNode }) => {
              const previewUrl = getImageNodeOutputUrl(imageNode);
              return (
                <div className="image-reference-chip connection-image-chip" key={linkId}>
                  {previewUrl ? (
                    <img src={normalizeImageUrl(previewUrl)} alt={formatImageInputLabel(imageNode)} />
                  ) : (
                    <div className="connection-image-placeholder">
                      <ImageIcon size={16} />
                    </div>
                  )}
                  <span className="connection-image-label" title={formatImageInputLabel(imageNode)}>
                    {formatImageInputLabel(imageNode)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveTextReference(linkId)}
                    title="移除图片引用并断开连线"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="node-field-wrap node-prompt-wrap">
        <textarea
          className="node-prompt-input"
          value={node.prompt || ''}
          onChange={(event) => onUpdateNode(node.id, { prompt: event.target.value, status: 'idle' })}
          placeholder={
            reversePromptMode ? '可选：补充反推指令（留空则输出中文结构化 JSON）' : '输入文字'
          }
        />
        <NodeEnlargeButton
          title="放大编辑输入"
          onClick={() => onOpenTextEdit(node.id, 'prompt')}
        />
      </div>
      <div className="node-bottom-actions">
        {reversePromptMode ? (
          <CustomSelect
            title="能力"
            icon={videoToPromptMode ? <Film size={14} /> : <ImageIcon size={14} />}
            value={videoToPromptMode ? 'video-understand' : 'image-understand'}
            options={[
              {
                value: videoToPromptMode ? 'video-understand' : 'image-understand',
                label: videoToPromptMode ? '视频理解' : '图片理解',
              },
            ]}
            onChange={() => {}}
          />
        ) : (
          <CustomSelect
            title="模型"
            icon={<Bot size={14} />}
            value={DEFAULT_TEXT_MODEL}
            options={[{ value: DEFAULT_TEXT_MODEL, label: DEFAULT_TEXT_MODEL }]}
            onChange={() => {}}
          />
        )}
        <div className="node-run-actions">
          {reversePromptMode ? (
            <button
              className="icon-button"
              onClick={() => onRunTextGeneration(node, 'translate-structured-en')}
              title="一键翻译反推结果为英文"
              disabled={isTranslating || isRunning || !canTranslateReverse}
            >
              {isTranslating ? <LoaderCircle size={14} className="spin-icon" /> : <Languages size={14} />}
              翻译
            </button>
          ) : (
            <button
              className="icon-button"
              onClick={() => onRunTextGeneration(node, 'translate-en')}
              title="一键翻译英文"
              disabled={isTranslating || isRunning || isPromptEmpty}
            >
              {isTranslating ? <LoaderCircle size={14} className="spin-icon" /> : <Languages size={14} />}
              翻译
            </button>
          )}
          <button
            className="icon-button primary"
            onClick={() => onRunTextGeneration(node)}
            title={
              videoToPromptMode
                ? '运行视频理解反推提示词'
                : imageToPromptMode
                  ? '运行图片理解反推提示词'
                  : '运行文本生成'
            }
            disabled={isRunning || isTranslating || (!canRunReversePrompt && !canRunText)}
          >
            {isRunning ? <LoaderCircle size={14} className="spin-icon" /> : <Play size={14} />}
            {reversePromptMode ? '反推' : '运行'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CanvasNode({
  node,
  isSelected,
  showToolbar = false,
  isRunning,
  isTranslating,
  textInputLinks = [],
  imageInputLinks = [],
  videoInputLinks = [],
  isInputsHighlighted = false,
  linkFromNodeId,
  pricingList,
  userProfile,
  onSelectNode,
  onClearConnectionSelection,
  onBeginDrag,
  onBeginResize,
  onOpenTextEdit,
  onOpenEnlargedSettings,
  onCopyNode,
  onUpdateNode,
  onRemoveNode,
  onRunTextGeneration,
  onRunImageGeneration,
  onRunVideoGeneration,
  onRunAudioGeneration,
  onOpenAssetLibrary,
  onUploadImageOutput,
  onUploadVideoOutput,
  onUploadAudioOutput,
  onRemoveImageReference,
  onRemoveTextReference,
  onHighlightInputs,
  onPreviewImage,
  onPreviewVideo,
  onDownloadVideo,
  onDownloadImage,
  onSyncImageOutputLayout,
  onSplitImageNode,
  onExplodeImageOutputs,
  onSyncVideoOutputLayout,
  onSyncAudioOutputLayout,
  onRemoveVeoFrame,
  onRemoveSeedanceMedia,
  onVideoGenerationTypeChange,
  onPortPointerDown,
  onFinishLink,
  onExtractVideoFrame,
  onExtractVideoClip,
  onExtractVideoAudio,
}) {
  const imageDisplayImages = node.type === 'image' ? getImageDisplayImages(node) : [];
  const canExplodeImageOutputs =
    node.type === 'image' && hasRealImageNodeOutput(node) && imageDisplayImages.length > 1;
  const videoDisplayUrl = node.type === 'video' ? getVideoDisplayUrl(node) : '';
  const audioDisplayUrl = node.type === 'audio' ? getAudioDisplayUrl(node) : '';

  const [openSplitMenu, setOpenSplitMenu] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [isExploding, setIsExploding] = useState(false);

  useEffect(() => {
    if (!openSplitMenu) return;
    const handleClose = () => setOpenSplitMenu(false);
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, [openSplitMenu]);

  async function handleSplitHeaderTrigger(cols, rows) {
    const imageUrl = imageDisplayImages[0];
    if (!imageUrl) return;
    setOpenSplitMenu(false);
    setIsSplitting(true);
    try {
      await onSplitImageNode(node.id, imageUrl, cols, rows);
    } catch (err) {
      alert(err.message || '图片切分失败');
    } finally {
      setIsSplitting(false);
    }
  }

  async function handleExplodeHeaderTrigger() {
    if (!canExplodeImageOutputs) return;
    setOpenSplitMenu(false);
    setIsExploding(true);
    try {
      await onExplodeImageOutputs?.(node.id);
    } catch (err) {
      alert(err.message || '拆分图片节点失败');
    } finally {
      setIsExploding(false);
    }
  }

  return (
    <article
      className={`node ${isSelected ? 'selected' : ''} ${isRunning ? 'is-running' : ''} ${node.type} ${node.isEntrance ? 'node-split-entrance' : ''}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: node.width ?? DEFAULT_NODE_WIDTH,
        height: node.height ?? DEFAULT_NODE_HEIGHT,
      }}
      onPointerDown={(event) => {
        onSelectNode(node.id, { additive: event.shiftKey });
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
            <>
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
              <button
                className="icon-mini"
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDownloadImage?.(imageDisplayImages, node.title || 'image');
                }}
                title="下载图片"
              >
                <Download size={14} />
              </button>
            </>
          ) : null}
          {node.type === 'video' && videoDisplayUrl ? (
            <>
              <button
                className="icon-mini"
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onPreviewVideo?.(videoDisplayUrl, node.title || '视频预览');
                }}
                title="预览视频"
              >
                <Maximize2 size={14} />
              </button>
              <button
                className="icon-mini"
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDownloadVideo?.(videoDisplayUrl, node.title || 'video');
                }}
                title="下载视频"
              >
                <Download size={14} />
              </button>
            </>
          ) : null}
          {node.type === 'audio' && audioDisplayUrl ? (
            <a
              className="icon-mini"
              href={normalizeAudioUrl(audioDisplayUrl)}
              download
              title="下载音频"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <Download size={14} />
            </a>
          ) : null}
          {node.type === 'image' && imageDisplayImages.length > 0 ? (
            <div className="node-header-split-wrapper" style={{ position: 'relative', display: 'inline-block' }} onPointerDown={(e) => e.stopPropagation()}>
              <button
                className={`icon-mini ${openSplitMenu ? 'active' : ''}`}
                type="button"
                disabled={isSplitting || isExploding}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpenSplitMenu(!openSplitMenu);
                }}
                title={canExplodeImageOutputs ? '拆分输出 / 宫格切分' : '宫格切分'}
              >
                <Scissors size={14} />
              </button>
              {openSplitMenu && (
                <div className="image-split-dropdown header-split-dropdown" onClick={(e) => e.stopPropagation()}>
                  {canExplodeImageOutputs ? (
                    <>
                      <button
                        type="button"
                        className="image-split-dropdown-item"
                        onClick={handleExplodeHeaderTrigger}
                      >
                        拆分为 {imageDisplayImages.length} 个独立节点
                      </button>
                      <div className="image-split-dropdown-divider" />
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="image-split-dropdown-item"
                    onClick={() => handleSplitHeaderTrigger(2, 2)}
                  >
                    2x2 (四宫格)
                  </button>
                  <button
                    type="button"
                    className="image-split-dropdown-item"
                    onClick={() => handleSplitHeaderTrigger(3, 3)}
                  >
                    3x3 (九宫格)
                  </button>
                  <button
                    type="button"
                    className="image-split-dropdown-item"
                    onClick={() => handleSplitHeaderTrigger(2, 1)}
                  >
                    2x1 (左右双格)
                  </button>
                  <button
                    type="button"
                    className="image-split-dropdown-item"
                    onClick={() => handleSplitHeaderTrigger(1, 2)}
                  >
                    1x2 (上下双格)
                  </button>
                </div>
              )}
            </div>
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
            showOutputActions={showToolbar}
            isInputsHighlighted={isInputsHighlighted}
            onBeginDrag={onBeginDrag}
            onHighlightInputs={onHighlightInputs}
            onOpenAssetLibrary={onOpenAssetLibrary}
            onUploadImageOutput={onUploadImageOutput}
            onSyncOutputLayout={onSyncImageOutputLayout}
          />
        ) : node.type === 'audio' ? (
          <AudioBody
            node={node}
            isRunning={isRunning}
            showOutputActions={showToolbar}
            isInputsHighlighted={isInputsHighlighted}
            onBeginDrag={onBeginDrag}
            onHighlightInputs={onHighlightInputs}
            onOpenAssetLibrary={onOpenAssetLibrary}
            onUploadAudioOutput={onUploadAudioOutput}
            onSyncAudioLayout={onSyncAudioOutputLayout}
          />
        ) : (
          <VideoBody
            node={node}
            isRunning={isRunning}
            showOutputActions={showToolbar}
            isInputsHighlighted={isInputsHighlighted}
            onBeginDrag={onBeginDrag}
            onHighlightInputs={onHighlightInputs}
            onOpenAssetLibrary={onOpenAssetLibrary}
            onUploadVideoOutput={onUploadVideoOutput}
            onSyncOutputLayout={onSyncVideoOutputLayout}
            onExtractVideoFrame={onExtractVideoFrame}
            onExtractVideoClip={onExtractVideoClip}
            onExtractVideoAudio={onExtractVideoAudio}
          />
        )}
      </div>

      {node.type === 'note' && showToolbar ? (
        <NoteToolbar
          node={node}
          isRunning={isRunning}
          isTranslating={isTranslating}
          imageInputLinks={imageInputLinks}
          videoInputLinks={videoInputLinks}
          onRunTextGeneration={onRunTextGeneration}
          onUpdateNode={onUpdateNode}
          onOpenTextEdit={onOpenTextEdit}
          onRemoveTextReference={onRemoveTextReference}
        />
      ) : node.type === 'image' && showToolbar ? (
        <ImageToolbar
          node={node}
          isRunning={isRunning}
          isTranslating={isTranslating}
          textInputLinks={textInputLinks}
          imageInputLinks={imageInputLinks}
          onRunImageGeneration={onRunImageGeneration}
          onOpenAssetLibrary={onOpenAssetLibrary}
          onRemoveImageReference={onRemoveImageReference}
          onRemoveTextReference={onRemoveTextReference}
          onUpdateNode={onUpdateNode}
          onOpenEnlargedSettings={onOpenEnlargedSettings}
          onPreviewImage={onPreviewImage}
          pricingList={pricingList}
          userProfile={userProfile}
        />
      ) : node.type === 'video' && showToolbar ? (
        <VideoToolbar
          node={node}
          isRunning={isRunning}
          isTranslating={isTranslating}
          textInputLinks={textInputLinks}
          imageInputLinks={imageInputLinks}
          videoInputLinks={videoInputLinks}
          onRunVideoGeneration={onRunVideoGeneration}
          onOpenAssetLibrary={onOpenAssetLibrary}
          onRemoveImageReference={onRemoveImageReference}
          onRemoveTextReference={onRemoveTextReference}
          onRemoveVeoFrame={onRemoveVeoFrame}
          onRemoveSeedanceMedia={onRemoveSeedanceMedia}
          onVideoGenerationTypeChange={onVideoGenerationTypeChange}
          onUpdateNode={onUpdateNode}
          onOpenEnlargedSettings={onOpenEnlargedSettings}
          onPreviewImage={onPreviewImage}
          pricingList={pricingList}
          userProfile={userProfile}
        />
      ) : node.type === 'audio' && showToolbar ? (
        <AudioToolbar
          node={node}
          isRunning={isRunning}
          isTranslating={isTranslating}
          textInputLinks={textInputLinks}
          onRunAudioGeneration={onRunAudioGeneration}
          onRemoveTextReference={onRemoveTextReference}
          onUpdateNode={onUpdateNode}
          pricingList={pricingList}
          userProfile={userProfile}
        />
      ) : null}

      {node.type === 'note' && showToolbar ? (
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
      {isSplitting && (
        <div className="image-split-loading-overlay">
          <div className="split-scan-grid">
            <div className="split-scan-line horizontal"></div>
            <div className="split-scan-line vertical"></div>
            <div className="split-grid-helper-line-h"></div>
            <div className="split-grid-helper-line-v"></div>
          </div>
          <LoaderCircle size={20} className="spin-icon" style={{ zIndex: 5 }} />
          <span style={{ zIndex: 5 }}>正在智能切分...</span>
        </div>
      )}
    </article>
  );
}
