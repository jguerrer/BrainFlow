import type { IdeaNode, PortSide } from '../types/brainflow';

export interface Point {
  x: number;
  y: number;
}

export const PORT_RADIUS = 6;
export const ALL_PORT_SIDES: PortSide[] = ['left', 'top', 'right', 'bottom'];

export function getInputPortSide(node: IdeaNode): PortSide {
  return node.inputPort?.side ?? 'left';
}

export function getOutputPortSide(node: IdeaNode): PortSide {
  return node.outputPort?.side ?? 'right';
}

export function getSideNormal(side: PortSide): Point {
  switch (side) {
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
  }
}

export function getEdgeAnchorPoint(
  node: IdeaNode,
  side: PortSide,
  offsetAlongEdge = 0
): Point {
  switch (side) {
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 + offsetAlongEdge };
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 + offsetAlongEdge };
    case 'top':
      return { x: node.x + node.width / 2 + offsetAlongEdge, y: node.y };
    case 'bottom':
      return { x: node.x + node.width / 2 + offsetAlongEdge, y: node.y + node.height };
  }
}

function getPortOffsetAlongEdge(node: IdeaNode, port: 'input' | 'output'): number {
  const inSide = getInputPortSide(node);
  const outSide = getOutputPortSide(node);
  if (inSide !== outSide) return 0;

  const isHorizontal = inSide === 'top' || inSide === 'bottom';
  const maxStep = isHorizontal
    ? Math.min(18, Math.max(10, node.width * 0.16))
    : Math.min(14, Math.max(8, node.height * 0.22));
  return port === 'input' ? -maxStep : maxStep;
}

export function getInputPortPoint(node: IdeaNode): Point {
  return getEdgeAnchorPoint(node, getInputPortSide(node), getPortOffsetAlongEdge(node, 'input'));
}

export function getOutputPortPoint(node: IdeaNode): Point {
  return getEdgeAnchorPoint(node, getOutputPortSide(node), getPortOffsetAlongEdge(node, 'output'));
}

export function getPortRimPoint(portPoint: Point, side: PortSide): Point {
  const normal = getSideNormal(side);
  return {
    x: portPoint.x + normal.x * PORT_RADIUS,
    y: portPoint.y + normal.y * PORT_RADIUS,
  };
}

function getConnectionControlPoints(
  p1: Point,
  p2: Point,
  fromSide: PortSide,
  toSide: PortSide
) {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const tension = Math.max(40, Math.min(180, dist * 0.45));
  const n1 = getSideNormal(fromSide);
  const n2 = getSideNormal(toSide);

  const c1x = p1.x + n1.x * tension;
  const c1y = p1.y + n1.y * tension;
  const c2x = p2.x + n2.x * tension;
  const c2y = p2.y + n2.y * tension;

  return {
    n1,
    n2,
    c1x,
    c1y,
    c2x,
    c2y,
    midX: 0.125 * p1.x + 0.375 * c1x + 0.375 * c2x + 0.125 * p2.x,
    midY: 0.125 * p1.y + 0.375 * c1y + 0.375 * c2y + 0.125 * p2.y,
  };
}

/**
 * Builds a direction-aware cubic Bézier path honoring the exit/entry sides (left, right,
 * top, or bottom) along with its t=0.5 midpoint for label placement.
 */
export function buildConnectionCurve(
  p1: Point,
  p2: Point,
  fromSide: PortSide = 'right',
  toSide: PortSide = 'left'
): { d: string; midX: number; midY: number } {
  const { c1x, c1y, c2x, c2y, midX, midY } = getConnectionControlPoints(
    p1,
    p2,
    fromSide,
    toSide
  );

  return {
    d: `M ${p1.x} ${p1.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`,
    midX,
    midY,
  };
}

/**
 * Builds two parallel offset cubic Bézier curves (+gap and -gap perpendicular to the
 * exit/entry normals) for representing bidirectional connectors cleanly.
 */
export function buildParallelConnectionCurves(
  p1: Point,
  p2: Point,
  fromSide: PortSide = 'right',
  toSide: PortSide = 'left',
  gap = 3.5
): { dForward: string; dBackward: string; midX: number; midY: number } {
  const { n1, n2, c1x, c1y, c2x, c2y, midX, midY } = getConnectionControlPoints(
    p1,
    p2,
    fromSide,
    toSide
  );

  // Rotate outward start tangent (n1) and inward end tangent (-n2) 90° clockwise
  const perp1 = { x: -n1.y, y: n1.x };
  const perp2 = { x: n2.y, y: -n2.x };

  const shiftCurve = (sign: number) =>
    `M ${p1.x + perp1.x * gap * sign} ${p1.y + perp1.y * gap * sign} ` +
    `C ${c1x + perp1.x * gap * sign} ${c1y + perp1.y * gap * sign}, ` +
    `${c2x + perp2.x * gap * sign} ${c2y + perp2.y * gap * sign}, ` +
    `${p2.x + perp2.x * gap * sign} ${p2.y + perp2.y * gap * sign}`;

  return {
    dForward: shiftCurve(-1),
    dBackward: shiftCurve(1),
    midX,
    midY,
  };
}

/**
 * Returns whichever of the 4 edge anchor points (left, top, right, bottom) on `node`
 * is closest to `(x, y)`.
 */
export function getNearestSideOnNode(node: IdeaNode, x: number, y: number): PortSide {
  let bestSide: PortSide = 'left';
  let bestDistSq = Infinity;
  for (const side of ALL_PORT_SIDES) {
    const pt = getEdgeAnchorPoint(node, side);
    const dSq = (x - pt.x) ** 2 + (y - pt.y) ** 2;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestSide = side;
    }
  }
  return bestSide;
}

/**
 * Finds the nearest connection anchor point (across all 4 sides of any other node)
 * within snap range, or falls back to the nearest side when touching a node box.
 */
export function findPortSnapTarget(
  nodes: IdeaNode[],
  x: number,
  y: number,
  excludeNodeId: number
): { node: IdeaNode; side: PortSide } | null {
  const portSnapDistSq = 24 * 24;
  let bestAnchor: { node: IdeaNode; side: PortSide } | null = null;
  let bestDistSq = portSnapDistSq;

  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.id === excludeNodeId || n.isGroup) continue;
    for (const side of ALL_PORT_SIDES) {
      const pt = getEdgeAnchorPoint(n, side);
      const distSq = (x - pt.x) ** 2 + (y - pt.y) ** 2;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        bestAnchor = { node: n, side };
      }
    }
  }
  if (bestAnchor) return bestAnchor;

  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.id === excludeNodeId || n.isGroup) continue;
    if (x >= n.x - 14 && x <= n.x + n.width + 14 && y >= n.y - 14 && y <= n.y + n.height + 14) {
      return { node: n, side: getNearestSideOnNode(n, x, y) };
    }
  }
  return null;
}

/**
 * Computes the intersection point on a node's rectangular perimeter
 * along the ray from the node center toward (targetX, targetY).
 */
export function getBoxEdgePoint(node: IdeaNode, targetX: number, targetY: number): Point {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  const halfW = node.width / 2;
  const halfH = node.height / 2;
  const scale = Math.min(
    dx !== 0 ? halfW / Math.abs(dx) : Infinity,
    dy !== 0 ? halfH / Math.abs(dy) : Infinity
  );

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

/**
 * Finds the topmost node overlapping or within `snapPadding` pixels of (x, y).
 * Regular idea nodes take precedence over group containers.
 */
export function findNodeAtPoint(
  nodes: IdeaNode[],
  x: number,
  y: number,
  snapPadding = 16
): IdeaNode | null {
  // First check regular idea boxes (topmost in visual z-index)
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.isGroup) continue;
    if (
      x >= n.x - snapPadding &&
      x <= n.x + n.width + snapPadding &&
      y >= n.y - snapPadding &&
      y <= n.y + n.height + snapPadding
    ) {
      return n;
    }
  }

  // Fallback to group containers (background layer)
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (!n.isGroup) continue;
    if (
      x >= n.x - snapPadding &&
      x <= n.x + n.width + snapPadding &&
      y >= n.y - snapPadding &&
      y <= n.y + n.height + snapPadding
    ) {
      return n;
    }
  }

  return null;
}

/**
 * Determines whether an idea node's center point is spatially inside a group container.
 */
export function isNodeInsideGroup(node: IdeaNode, group: IdeaNode): boolean {
  if (node.id === group.id || node.isGroup || !group.isGroup) return false;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  return (
    cx >= group.x &&
    cx <= group.x + group.width &&
    cy >= group.y &&
    cy <= group.y + group.height
  );
}

/**
 * Returns all idea nodes that are grouped inside a specific group container.
 */
export function getContainedIdeas(group: IdeaNode, allNodes: IdeaNode[]): IdeaNode[] {
  if (!group.isGroup) return [];
  const spatialMatches = allNodes.filter((n) => !n.isGroup && isNodeInsideGroup(n, group));
  const spatialIds = new Set(spatialMatches.map((n) => n.id));

  if (Array.isArray(group.groupNodeIds) && group.groupNodeIds.length > 0) {
    const refIds = new Set(group.groupNodeIds);
    const result: IdeaNode[] = [];
    for (const n of allNodes) {
      if (!n.isGroup && (refIds.has(n.id) || spatialIds.has(n.id))) {
        result.push(n);
      }
    }
    return result;
  }

  return spatialMatches;
}

/**
 * Returns an array of node IDs of all ideas inside a group.
 */
export function getContainedNodeIds(group: IdeaNode, allNodes: IdeaNode[]): number[] {
  return getContainedIdeas(group, allNodes).map((n) => n.id);
}

/**
 * Converts browser client coordinates into SVG world coordinates accounting for pan & zoom.
 */
export function clientToCanvas(
  svgElement: SVGSVGElement,
  clientX: number,
  clientY: number,
  pan: Point,
  zoom: number
): Point {
  const rect = svgElement.getBoundingClientRect();
  return {
    x: (clientX - rect.left - pan.x) / zoom,
    y: (clientY - rect.top - pan.y) / zoom,
  };
}
