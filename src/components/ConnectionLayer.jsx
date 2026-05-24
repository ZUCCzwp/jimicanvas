import { getConnectionPath, getDraftConnectionPath } from '../lib/canvas';

export function ConnectionLayer({
  nodes,
  connections,
  selectedConnectionId,
  linkFromNodeId,
  pointerPos,
  onSelectConnection,
}) {
  return (
    <svg className="connection-layer" width="100%" height="100%">
      <defs>
        <marker
          id="arrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#60a5fa" />
        </marker>
      </defs>
      {connections.map((link) => {
        const source = nodes.find((node) => node.id === link.fromNodeId);
        const target = nodes.find((node) => node.id === link.toNodeId);
        if (!source || !target) return null;
        const isSelected = link.id === selectedConnectionId;
        const pathData = getConnectionPath(source, target);
        return (
          <g key={link.id}>
            <path
              className="connection-hit-area"
              d={pathData}
              fill="none"
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelectConnection(link.id);
              }}
            />
            <path
              className={`connection-path ${isSelected ? 'selected' : ''}`}
              d={pathData}
              fill="none"
              markerEnd="url(#arrow)"
            />
          </g>
        );
      })}
      {linkFromNodeId ? (
        (() => {
          const source = nodes.find((node) => node.id === linkFromNodeId);
          if (!source) return null;
          return (
            <path
              d={getDraftConnectionPath(source, pointerPos)}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="8 8"
            />
          );
        })()
      ) : null}
    </svg>
  );
}
