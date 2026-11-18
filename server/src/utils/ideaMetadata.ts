import { prisma } from '../db/prisma.js';

/**
 * Normalizes an IdeaNode to expose isGroup and groupNodeIds at the top level
 * using its persisted inputPort metadata.
 */
export function formatNodeForClient<T extends { inputPort?: unknown }>(
  node: T
): T & { isGroup: boolean; groupNodeIds: number[] } {
  const port =
    node.inputPort && typeof node.inputPort === 'object' && !Array.isArray(node.inputPort)
      ? (node.inputPort as Record<string, unknown>)
      : null;
  const isGroup = Boolean(port?.isGroup);
  const groupNodeIds = Array.isArray(port?.nodeIds)
    ? (port!.nodeIds as number[]).filter((id): id is number => typeof id === 'number')
    : [];
  return {
    ...node,
    isGroup,
    groupNodeIds,
  };
}

/**
 * Computes complexity label from node and connection counts.
 */
export function computeComplexity(nodeCount: number, connectionCount: number): 'Low' | 'Medium' | 'High' {
  const total = nodeCount + connectionCount;
  if (total <= 5) return 'Low';
  if (total <= 12) return 'Medium';
  return 'High';
}

/**
 * Recalculates itemCount, complexity, and updates lastAccess on an Idea.
 */
export async function syncIdeaMetadata(ideaId: number) {
  const [nodeCount, connectionCount] = await Promise.all([
    prisma.ideaNode.count({ where: { ideaId } }),
    prisma.ideaConnection.count({ where: { ideaId } }),
  ]);

  const complexity = computeComplexity(nodeCount, connectionCount);

  return prisma.idea.update({
    where: { id: ideaId },
    data: {
      itemCount: nodeCount,
      complexity,
      lastAccess: new Date(),
    },
  });
}
