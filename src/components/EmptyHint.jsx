import { PencilLine } from 'lucide-react';

export function EmptyHint() {
  return (
    <div className="empty-hint">
      <PencilLine size={14} />
      拖动节点，点击右侧圆点发起连线，再点另一个节点的左侧圆点完成连接。
    </div>
  );
}
