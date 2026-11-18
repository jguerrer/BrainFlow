import type { CardinalityMode, IdeaConnection, IdeaNode } from '../types/brainflow';

export interface NodeDegree {
  incoming: number;
  outgoing: number;
  total: number;
}

export function computeNodeDegrees(
  nodes: IdeaNode[],
  connections: IdeaConnection[]
): Record<number, NodeDegree> {
  const map: Record<number, NodeDegree> = {};
  for (const node of nodes) {
    map[node.id] = { incoming: 0, outgoing: 0, total: 0 };
  }

  for (const conn of connections) {
    if (map[conn.fromNodeId]) {
      map[conn.fromNodeId].outgoing += 1;
      if (conn.bidirectional) map[conn.fromNodeId].incoming += 1;
      map[conn.fromNodeId].total += 1;
    }
    if (map[conn.toNodeId]) {
      map[conn.toNodeId].incoming += 1;
      if (conn.bidirectional) map[conn.toNodeId].outgoing += 1;
      map[conn.toNodeId].total += 1;
    }
  }
  return map;
}

export interface CardinalityVisual {
  ringColor: string | null;
  ringWidth: number;
  dashed: boolean;
  dimmed: boolean;
}

export function getCardinalityVisual(
  degree: NodeDegree,
  mode: CardinalityMode
): CardinalityVisual {
  if (mode === 'off') {
    return { ringColor: null, ringWidth: 0, dashed: false, dimmed: false };
  }

  if (mode === 'degree') {
    if (degree.total === 0) {
      return { ringColor: '#94a3b8', ringWidth: 1.5, dashed: true, dimmed: false };
    }
    if (degree.total >= 3) {
      return { ringColor: '#f59e0b', ringWidth: 2.5, dashed: false, dimmed: false };
    }
    return { ringColor: '#3b82f6', ringWidth: 1.5, dashed: false, dimmed: false };
  }

  if (mode === 'hubs') {
    return degree.total >= 3
      ? { ringColor: '#f59e0b', ringWidth: 3, dashed: false, dimmed: false }
      : { ringColor: null, ringWidth: 0, dashed: false, dimmed: true };
  }

  // isolated
  return degree.total === 0
    ? { ringColor: '#94a3b8', ringWidth: 2.5, dashed: true, dimmed: false }
    : { ringColor: null, ringWidth: 0, dashed: false, dimmed: true };
}
