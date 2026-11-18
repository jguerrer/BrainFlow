import type { IdeaConnection, IdeaNode } from '../../types/brainflow';
import {
  buildConnectionCurve,
  buildParallelConnectionCurves,
  getEdgeAnchorPoint,
  getInputPortSide,
  getOutputPortSide,
  getPortRimPoint,
} from '../../utils/geometry';

interface DirectedEdgeProps {
  connection: IdeaConnection;
  fromNode: IdeaNode;
  toNode: IdeaNode;
  selected: boolean;
  onSelect: (e: React.MouseEvent<SVGGElement>, connectionId: number) => void;
  onStartEdit: (connection: IdeaConnection) => void;
  onLabelMouseDown: (e: React.MouseEvent<SVGGElement>, connection: IdeaConnection) => void;
  onLabelResizeMouseDown: (e: React.MouseEvent<SVGGElement>, connection: IdeaConnection) => void;
  onEndpointMouseDown: (
    e: React.MouseEvent<SVGGElement>,
    connection: IdeaConnection,
    end: 'from' | 'to'
  ) => void;
}

export function DirectedEdge({
  connection,
  fromNode,
  toNode,
  selected,
  onSelect,
  onStartEdit,
  onLabelMouseDown,
  onLabelResizeMouseDown,
  onEndpointMouseDown,
}: DirectedEdgeProps) {
  const fromSide = connection.fromSide ?? getOutputPortSide(fromNode);
  const toSide = connection.toSide ?? getInputPortSide(toNode);
  const outPort = getEdgeAnchorPoint(fromNode, fromSide);
  const inPort = getEdgeAnchorPoint(toNode, toSide);
  // Start and end right at the outer rim along each anchor's edge normal
  const p1 = getPortRimPoint(outPort, fromSide);
  const p2 = getPortRimPoint(inPort, toSide);
  const isBidirectional = Boolean(connection.bidirectional);
  const parallel = isBidirectional
    ? buildParallelConnectionCurves(p1, p2, fromSide, toSide, 3.5)
    : null;
  const single = !isBidirectional
    ? buildConnectionCurve(p1, p2, fromSide, toSide)
    : null;
  const d = single?.d ?? parallel!.dForward;
  const mx = single?.midX ?? parallel!.midX;
  const my = single?.midY ?? parallel!.midY;

  const markerId = `arrow-${connection.color.replace('#', '')}`;
  const hasExtras =
    Object.keys(connection.properties || {}).length > 0 ||
    (connection.actions || []).length > 0;
  const offsetX = connection.labelOffsetX ?? 0;
  const offsetY = connection.labelOffsetY ?? 0;
  const labelW = Math.max(40, connection.labelWidth ?? 96);
  const labelH = Math.max(20, connection.labelHeight ?? 24);
  const cx = mx + offsetX;
  const cy = my + offsetY;
  const rx = cx - labelW / 2;
  const ry = cy - labelH / 2;
  const showTether = Math.hypot(offsetX, offsetY) > 12;

  return (
    <g
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(e, connection.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit(connection);
      }}
      className="cursor-pointer"
    >
      <title>Double-click to edit connection • Drag label to move • Drag corner to resize</title>
      {/* Wide transparent hit target for easy clicking */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={18} />

      {/* Visible connection curve(s): single solid OR double parallel dashed for bidirectional */}
      {isBidirectional && parallel ? (
        <>
          <path
            d={parallel.dForward}
            fill="none"
            stroke={connection.color}
            strokeWidth={selected ? 2.5 : 1.75}
            strokeDasharray="6 4"
            markerEnd={`url(#${markerId})`}
          />
          <path
            d={parallel.dBackward}
            fill="none"
            stroke={connection.color}
            strokeWidth={selected ? 2.5 : 1.75}
            strokeDasharray="6 4"
            markerStart={`url(#${markerId})`}
          />
        </>
      ) : (
        <path
          d={d}
          fill="none"
          stroke={connection.color}
          strokeWidth={selected ? 3.5 : 2}
          markerEnd={`url(#${markerId})`}
        />
      )}

      {/* Subtle tether when label has been dragged away from curve midpoint */}
      {showTether && (
        <line
          x1={mx}
          y1={my}
          x2={cx}
          y2={cy}
          stroke={selected ? connection.color : '#475569'}
          strokeWidth={1}
          strokeDasharray="3 3"
          className="pointer-events-none"
        />
      )}

      {/* Movable & Resizable Pointed Hexagon Connection Label Symbol */}
      {(() => {
        const cap = Math.min(12, labelH / 2, labelW / 4);
        const hexPoints = [
          `${rx},${cy}`,
          `${rx + cap},${ry}`,
          `${rx + labelW - cap},${ry}`,
          `${rx + labelW},${cy}`,
          `${rx + labelW - cap},${ry + labelH}`,
          `${rx + cap},${ry + labelH}`,
        ].join(' ');

        return (
          <g
            onMouseDown={(e) => {
              e.stopPropagation();
              onLabelMouseDown(e, connection);
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <polygon
              points={hexPoints}
              fill="#0f172a"
              fillOpacity={0.95}
              stroke={connection.color}
              strokeOpacity={selected ? 1 : 0.7}
              strokeWidth={selected ? 1.75 : 1.25}
              strokeLinejoin="round"
            />
            <foreignObject
              x={rx}
              y={ry}
              width={labelW}
              height={labelH}
              style={{ overflow: 'visible' }}
              className="pointer-events-none"
            >
              <div
                style={{ overflow: 'visible' }}
                className="w-full h-full px-3 flex items-center justify-center text-center text-xs font-medium text-slate-200 leading-tight break-words"
              >
                <span>
                  {connection.label}
                  {hasExtras ? ' •' : ''}
                </span>
              </div>
            </foreignObject>

            {/* Bottom-right resize handle */}
            <g
              onMouseDown={(e) => {
                e.stopPropagation();
                onLabelResizeMouseDown(e, connection);
              }}
              className="cursor-nwse-resize"
            >
              <rect
                x={rx + labelW - 12}
                y={ry + labelH - 12}
                width={12}
                height={12}
                fill="transparent"
              />
              <circle
                cx={rx + labelW - cap * 0.55 - 2}
                cy={ry + labelH - 3.5}
                r={2}
                fill={selected ? connection.color : '#94a3b8'}
              />
            </g>
          </g>
        );
      })()}

      {/* Draggable start/end anchor handles when connection is selected */}
      {selected && (
        <>
          <g
            onMouseDown={(e) => {
              e.stopPropagation();
              onEndpointMouseDown(e, connection, 'from');
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <title>Drag start point to any edge (Left / Top / Right / Bottom)</title>
            <circle cx={p1.x} cy={p1.y} r={10} fill="transparent" />
            <circle
              cx={p1.x}
              cy={p1.y}
              r={4.5}
              fill="#0f172a"
              stroke={connection.color}
              strokeWidth={2}
            />
          </g>
          <g
            onMouseDown={(e) => {
              e.stopPropagation();
              onEndpointMouseDown(e, connection, 'to');
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <title>Drag end point to any edge (Left / Top / Right / Bottom)</title>
            <circle cx={p2.x} cy={p2.y} r={10} fill="transparent" />
            <circle
              cx={p2.x}
              cy={p2.y}
              r={4.5}
              fill={connection.color}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          </g>
        </>
      )}
    </g>
  );
}
