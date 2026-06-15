import { sseManager } from './sseManager';
import { getTaskDetail, normalizeVideoUrl, pickOmniQueryVideoUrl, queryOmniVideoTaskOnce } from './videoApi';

const TASK_SUCCESS_STATUS = new Set(['success', 'completed', 'succeed', '1']);
const TASK_FAILED_STATUS = new Set(['failed', 'error', 'failure', 'fail', 'cancelled', 'canceled', '2']);

function normalizeTaskStatus(status) {
  return String(status ?? '').trim().toLowerCase();
}

function isTaskSuccess(status) {
  return TASK_SUCCESS_STATUS.has(normalizeTaskStatus(status));
}

function isTaskFailed(status) {
  return TASK_FAILED_STATUS.has(normalizeTaskStatus(status));
}

function isVideoGenTaskEvent(event, taskId) {
  if (!event || event.type !== 'task_update') return false;
  const taskType = event.taskType || event.payload?.taskType;
  if (taskType !== 'video_gen' && taskType !== 'video_generation') return false;
  return String(event.payload?.taskId || '') === String(taskId || '');
}

export function pickSSEVideoUrl(payload = {}) {
  return normalizeVideoUrl(
    payload.videoUrl ||
      payload.video_url ||
      payload.videoPath ||
      payload.video_path ||
      payload.extra?.videoPath ||
      payload.extra?.videoUrl ||
      ''
  );
}

function extractSSEError(payload = {}) {
  return (
    payload.remark ||
    payload.extra?.remark ||
    payload.extra?.reason ||
    '视频生成失败'
  );
}

async function fetchOmniVideoUrlFallback({ token, taskId, queryModel }) {
  const data = await queryOmniVideoTaskOnce({ token, taskId, queryModel });
  if (isTaskSuccess(data?.status)) {
    return pickOmniQueryVideoUrl(data);
  }
  return '';
}

async function fetchTaskVideoUrlFallback({ token, taskId }) {
  const task = await getTaskDetail({ token, taskId });
  if (isTaskSuccess(task?.status)) {
    return normalizeVideoUrl(task.videoPath || task.video_path || '');
  }
  return '';
}

/**
 * 通过 SSE 等待视频任务完成（无轮询），Omni 等线路使用。
 */
export function waitForVideoTaskViaSSE({
  token,
  taskId,
  provider = 'omni',
  queryModel,
  timeoutMs = 20 * 60 * 1000,
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    if (!taskId) {
      reject(new Error('缺少任务 ID'));
      return;
    }

    let settled = false;
    let timeoutId;
    let unsubscribe;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unsubscribe) unsubscribe();
    };

    const finishResolve = (url) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(url);
    };

    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error || '视频生成失败')));
    };

    const handleEvent = (event) => {
      if (!isVideoGenTaskEvent(event, taskId)) return;

      const payload = event.payload || {};
      const status = payload.status;

      if (onProgress) {
        onProgress({
          status,
          progress: typeof payload.progress === 'number' ? payload.progress : undefined,
        });
      }

      if (isTaskSuccess(status)) {
        const url = pickSSEVideoUrl(payload);
        if (url) {
          finishResolve(url);
        }
        return;
      }

      if (isTaskFailed(status)) {
        finishReject(new Error(extractSSEError(payload)));
      }
    };

    unsubscribe = sseManager.onMessage(handleEvent);
    sseManager.connect();
    void sseManager.syncCachedEvents().catch(() => {});

    timeoutId = setTimeout(async () => {
      try {
        const url =
          provider === 'omni'
            ? await fetchOmniVideoUrlFallback({ token, taskId, queryModel })
            : await fetchTaskVideoUrlFallback({ token, taskId });
        if (url) {
          finishResolve(url);
          return;
        }
      } catch {
        // ignore fallback errors, use timeout message below
      }
      finishReject(new Error('视频生成超时，请稍后在任务中心查看'));
    }, timeoutMs);
  });
}
