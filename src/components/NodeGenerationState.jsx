import { useEffect, useState } from 'react';

const STATUS_LABELS = {
  pending: '排队中',
  queued: '排队中',
  processing: '生成中',
  in_progress: '生成中',
  running: '生成中',
  0: '生成中',
};

function resolveGenerationProgress(node, kind) {
  const batch = node?.generationBatch;
  const taskProgress = Number(node?.taskProgress);
  const hasTaskProgress = Number.isFinite(taskProgress) && taskProgress > 0;

  if (kind === 'video' && hasTaskProgress) {
    if (batch?.total > 1) {
      const completed = Number(batch.completed) || 0;
      const total = Number(batch.total) || 1;
      const slice = 100 / total;
      return Math.min(99, Math.round(completed * slice + (taskProgress / 100) * slice));
    }
    return Math.min(99, Math.round(taskProgress));
  }

  if (batch?.total > 1) {
    const completed = Number(batch.completed) || 0;
    const total = Number(batch.total) || 1;
    if (completed < total) {
      const slice = 100 / total;
      const inBatchProgress = hasTaskProgress ? (taskProgress / 100) * slice : slice * 0.45;
      return Math.min(99, Math.round(completed * slice + inBatchProgress));
    }
  }

  if (hasTaskProgress) {
    return Math.min(99, Math.round(taskProgress));
  }

  return null;
}

function useSimulatedProgress(active, realProgress) {
  const [simulated, setSimulated] = useState(8);

  useEffect(() => {
    if (!active || (realProgress != null && realProgress > 0)) {
      setSimulated(8);
      return undefined;
    }

    const start = Date.now();
    let frame = 0;

    const tick = () => {
      const elapsed = Date.now() - start;
      const next = Math.min(92, 8 + 84 * (1 - Math.exp(-elapsed / 52000)));
      setSimulated(Math.round(next));
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, realProgress]);

  if (realProgress != null && realProgress > 0) {
    return realProgress;
  }

  return active ? simulated : 0;
}

export function NodeGenerationState({ node, kind, label, onBeginDrag }) {
  const realProgress = resolveGenerationProgress(node, kind);
  const displayProgress = useSimulatedProgress(true, realProgress);
  const ringRadius = 34;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (displayProgress / 100) * ringCircumference;

  const batch = node?.generationBatch;
  const batchTotal = Number(batch?.total) || 0;
  const batchCompleted = Number(batch?.completed) || 0;
  const batchLabel =
    batchTotal > 1 ? `第 ${Math.min(batchCompleted + 1, batchTotal)} / ${batchTotal} 个` : '';

  const statusKey = String(node?.taskStatus ?? '').toLowerCase();
  const statusLabel = STATUS_LABELS[statusKey] || STATUS_LABELS[node?.taskStatus] || 'AI 创作中';

  return (
    <div
      className={`node-gen-state node-gen-state-${kind}`}
      onPointerDown={(event) => onBeginDrag?.(event, node)}
    >
      <div className="node-gen-aurora" aria-hidden="true">
        <span className="node-gen-aurora-blob blob-a" />
        <span className="node-gen-aurora-blob blob-b" />
        <span className="node-gen-aurora-blob blob-c" />
      </div>
      <div className="node-gen-grid" aria-hidden="true" />
      <div className="node-gen-scanline" aria-hidden="true" />

      <div className="node-gen-core">
        <svg className="node-gen-ring" viewBox="0 0 88 88" aria-hidden="true">
          <circle className="node-gen-ring-track" cx="44" cy="44" r={ringRadius} />
          <circle
            className="node-gen-ring-progress"
            cx="44"
            cy="44"
            r={ringRadius}
            style={{
              strokeDasharray: ringCircumference,
              strokeDashoffset: ringOffset,
            }}
          />
        </svg>

        <div className="node-gen-orbit" aria-hidden="true">
          <span className="node-gen-orbit-dot dot-1" />
          <span className="node-gen-orbit-dot dot-2" />
          <span className="node-gen-orbit-dot dot-3" />
        </div>

        <div className="node-gen-center">
          <div className="node-gen-percent">{displayProgress}%</div>
        </div>
      </div>

      <div className="node-gen-meta">
        <strong>{label}</strong>
        <span className="node-gen-status">{statusLabel}</span>
        {batchLabel ? <span className="node-gen-batch">{batchLabel}</span> : null}
      </div>

      <div className="node-gen-bar" aria-hidden="true">
        <div className="node-gen-bar-fill" style={{ width: `${displayProgress}%` }} />
        <div className="node-gen-bar-shimmer" />
      </div>
    </div>
  );
}
