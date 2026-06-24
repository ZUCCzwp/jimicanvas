import { normalizeVideoUrl } from './videoApi';

function pickAudioRecorderMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function pickVideoRecorderMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function extensionForMimeType(mimeType, fallback = 'audio') {
  const value = String(mimeType || '').toLowerCase();
  if (value.includes('webm') && value.startsWith('video/')) return 'webm';
  if (value.includes('webm')) return 'webm';
  if (value.includes('ogg')) return 'ogg';
  if (value.includes('mp4') && value.startsWith('video/')) return 'mp4';
  if (value.includes('mp4')) return 'm4a';
  return fallback;
}

export function buildExtractedAudioFilename(mimeType) {
  return `extracted_audio.${extensionForMimeType(mimeType, 'webm')}`;
}

export function buildExtractedVideoFilename(mimeType) {
  return `extracted_video.${extensionForMimeType(mimeType, 'webm')}`;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForMediaEvent(media, eventName, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (eventName === 'loadedmetadata' && media.readyState >= 1) {
      resolve();
      return;
    }
    if (eventName === 'canplay' && media.readyState >= 2) {
      resolve();
      return;
    }
    if (eventName === 'playing' && !media.paused) {
      resolve();
      return;
    }

    const timerId = window.setTimeout(() => {
      cleanup();
      reject(new Error('加载视频超时，请重试'));
    }, timeoutMs);

    function cleanup() {
      window.clearTimeout(timerId);
      media.removeEventListener(eventName, handleReady);
      media.removeEventListener('error', handleError);
    }

    function handleReady() {
      cleanup();
      resolve();
    }

    function handleError() {
      cleanup();
      reject(new Error('视频加载失败，无法分离音视频'));
    }

    media.addEventListener(eventName, handleReady, { once: true });
    media.addEventListener('error', handleError, { once: true });
  });
}

async function resolveLocalVideoPlaybackUrl(videoUrl) {
  const normalized = normalizeVideoUrl(videoUrl);
  if (!normalized) {
    throw new Error('该节点没有有效的视频地址');
  }

  if (normalized.startsWith('data:') || normalized.startsWith('blob:')) {
    return { playbackUrl: normalized, revoke: null };
  }

  try {
    const response = await fetch(normalized, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`视频下载失败: ${response.status}`);
    }
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error('视频文件为空，无法分离音视频');
    }
    const blobUrl = URL.createObjectURL(blob);
    return {
      playbackUrl: blobUrl,
      revoke: () => URL.revokeObjectURL(blobUrl),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('视频')) {
      throw error;
    }
    throw new Error('视频跨域受限，无法下载并分离音视频');
  }
}

function prepareMediaForCapture(media) {
  media.muted = false;
  media.defaultMuted = false;
  media.volume = 1;
}

async function ensureMediaPlaying(media) {
  prepareMediaForCapture(media);

  if (media.readyState < 1) {
    await waitForMediaEvent(media, 'loadedmetadata');
  }

  if (!Number.isFinite(media.duration) || media.duration <= 0) {
    throw new Error('无法读取视频时长');
  }

  if (media.paused) {
    media.currentTime = 0;
    await media.play();
  }

  await waitForMediaEvent(media, 'playing', 8000);
  await delay(120);
}

async function createWebAudioStream(media, seedAudioContext = null) {
  const ownsAudioContext = !seedAudioContext;
  const audioContext = seedAudioContext || new AudioContext();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const sourceNode = audioContext.createMediaElementSource(media);
  const destination = audioContext.createMediaStreamDestination();
  sourceNode.connect(destination);
  sourceNode.connect(audioContext.destination);

  return {
    stream: destination.stream,
    cleanup() {
      try {
        sourceNode.disconnect();
      } catch {
        // ignore
      }
      if (ownsAudioContext && audioContext.state !== 'closed') {
        void audioContext.close();
      }
    },
  };
}

function getVideoStreamFromMedia(media) {
  try {
    const captureStream = media.captureStream || media.mozCaptureStream;
    if (!captureStream) return null;
    const stream = captureStream.call(media);
    const videoTracks = stream.getVideoTracks();
    if (!videoTracks.length) return null;
    return new MediaStream(videoTracks);
  } catch {
    return null;
  }
}

function recordSeparatedMedia({
  audioStream,
  videoStream,
  media,
  audioMimeType,
  videoMimeType,
}) {
  return new Promise((resolve, reject) => {
    const audioChunks = [];
    const videoChunks = [];
    let stopTimerId = null;
    let finished = false;
    let recordersDone = 0;
    const expectedRecorders = videoStream ? 2 : 1;
    let failed = false;

    const audioRecorder = new MediaRecorder(audioStream, {
      mimeType: audioMimeType,
      audioBitsPerSecond: 128000,
    });
    const videoRecorder = videoStream
      ? new MediaRecorder(videoStream, {
          mimeType: videoMimeType,
          videoBitsPerSecond: 2500000,
        })
      : null;

    function finishCleanup() {
      if (finished) return;
      finished = true;
      window.clearTimeout(stopTimerId);
      media.onended = null;
      media.pause();
      try {
        media.currentTime = 0;
      } catch {
        // ignore
      }
    }

    function stopRecording() {
      if (audioRecorder.state !== 'inactive') {
        try {
          audioRecorder.requestData();
        } catch {
          // ignore
        }
        audioRecorder.stop();
      }
      if (videoRecorder && videoRecorder.state !== 'inactive') {
        try {
          videoRecorder.requestData();
        } catch {
          // ignore
        }
        videoRecorder.stop();
      }
    }

    function checkComplete() {
      recordersDone += 1;
      if (recordersDone < expectedRecorders) return;

      finishCleanup();
      if (failed) return;

      const audioBlob = new Blob(audioChunks, { type: audioMimeType });
      const videoBlob = videoChunks.length
        ? new Blob(videoChunks, { type: videoMimeType })
        : null;

      if (!audioBlob.size) {
        reject(new Error('未能提取到音频，请确认视频包含音轨'));
        return;
      }

      resolve({ audioBlob, videoBlob });
    }

    audioRecorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        audioChunks.push(event.data);
      }
    };
    audioRecorder.onerror = () => {
      failed = true;
      finishCleanup();
      reject(new Error('音频分离失败，请重试'));
    };
    audioRecorder.onstop = checkComplete;

    if (videoRecorder) {
      videoRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          videoChunks.push(event.data);
        }
      };
      videoRecorder.onerror = () => {
        if (videoRecorder.state !== 'inactive') {
          try {
            videoRecorder.stop();
          } catch {
            // ignore
          }
        }
      };
      videoRecorder.onstop = checkComplete;
    }

    stopTimerId = window.setTimeout(
      stopRecording,
      Math.ceil(media.duration * 1000) + 3000
    );
    media.onended = stopRecording;

    try {
      audioRecorder.start();
      videoRecorder?.start();
    } catch (error) {
      finishCleanup();
      reject(error instanceof Error ? error : new Error('音视频分离失败，请重试'));
    }
  });
}

export async function extractVideoAudioAndPicture(videoUrl, options = {}) {
  const { playbackUrl, revoke } = await resolveLocalVideoPlaybackUrl(videoUrl);
  const media = document.createElement('video');
  media.preload = 'auto';
  media.playsInline = true;
  media.src = playbackUrl;

  let webAudioCleanup = null;

  try {
    await ensureMediaPlaying(media);

    const audioMimeType = pickAudioRecorderMimeType();
    if (!audioMimeType) {
      throw new Error('当前浏览器不支持音频录制');
    }

    const videoMimeType = pickVideoRecorderMimeType();
    const webAudio = await createWebAudioStream(media, options.audioContext || null);
    webAudioCleanup = webAudio.cleanup;
    const videoStream = videoMimeType ? getVideoStreamFromMedia(media) : null;
    await delay(120);

    const result = await recordSeparatedMedia({
      audioStream: webAudio.stream,
      videoStream,
      media,
      audioMimeType,
      videoMimeType: videoMimeType || 'video/webm',
    });
    webAudioCleanup?.();
    return result;
  } catch (error) {
    webAudioCleanup?.();
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      throw new Error('浏览器阻止播放，请重试一次');
    }
    throw error instanceof Error ? error : new Error('音视频分离失败，请重试');
  } finally {
    media.pause();
    media.removeAttribute('src');
    media.load();
    revoke?.();
  }
}

export async function extractVideoAudio(videoUrl, options = {}) {
  const { audioBlob } = await extractVideoAudioAndPicture(videoUrl, options);
  return audioBlob;
}

export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
