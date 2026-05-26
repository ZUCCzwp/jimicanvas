import { getConnectionPath, getDraftConnectionPath } from '../lib/canvas';

export function ConnectionLayer({
  nodes,
  connections,
  selectedConnectionId,
  highlightedConnectionIds = [],
  linkFromNodeId,
  pointerPos,
  onSelectConnection,
}) {
  const highlightedIds = new Set(highlightedConnectionIds);
  return (
    <svg className="connection-layer" aria-hidden="true">
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
        <marker
          id="arrow-highlight"
          markerWidth="7"
          markerHeight="7"
          refX="5.5"
          refY="3.5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L0,7 L7,3.5 z" fill="rgba(153, 246, 228, 0.95)" />
        </marker>
        <filter id="connection-flow-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.65 0"
            result="soft"
          />
          <feMerge>
            <feMergeNode in="soft" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {connections.map((link) => {
        const source = nodes.find((node) => node.id === link.fromNodeId);
        const target = nodes.find((node) => node.id === link.toNodeId);
        if (!source || !target) return null;
        const isSelected = link.id === selectedConnectionId;
        const isHighlighted = highlightedIds.has(link.id);
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
              className={`connection-path ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
              d={pathData}
              fill="none"
              markerEnd={isHighlighted ? 'url(#arrow-highlight)' : 'url(#arrow)'}
            />
            {isHighlighted ? (
              <>
                <path className="connection-path-track" d={pathData} fill="none" />
                <path className="connection-path-glow" d={pathData} fill="none" />
                <path
                  className="connection-path-flow"
                  d={pathData}
                  fill="none"
                  filter="url(#connection-flow-glow)"
                />
              </>
            ) : null}
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
