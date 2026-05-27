import { LocateFixed } from 'lucide-react';

export function FocusContentPrompt({ nodeCount, onFocus }) {
  return (
    <div className="focus-content-prompt" onPointerDown={(event) => event.stopPropagation()}>
      <p className="focus-content-copy">
        当前画面看不到节点
        {nodeCount > 0 ? `（共 ${nodeCount} 个）` : ''}
      </p>
      <button type="button" className="focus-content-button" onClick={onFocus}>
        <LocateFixed size={16} aria-hidden="true" />
        回到内容区域
      </button>
    </div>
  );
}
