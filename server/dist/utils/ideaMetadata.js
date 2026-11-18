"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatNodeForClient = formatNodeForClient;
exports.computeComplexity = computeComplexity;
exports.syncIdeaMetadata = syncIdeaMetadata;
const prisma_js_1 = require("../db/prisma.js");
/**
 * Normalizes an IdeaNode to expose isGroup and groupNodeIds at the top level
 * using its persisted inputPort metadata.
 */
function formatNodeForClient(node) {
    const port = node.inputPort && typeof node.inputPort === 'object' && !Array.isArray(node.inputPort)
        ? node.inputPort
        : null;
    const isGroup = Boolean(port?.isGroup);
    const groupNodeIds = Array.isArray(port?.nodeIds)
        ? port.nodeIds.filter((id) => typeof id === 'number')
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
function computeComplexity(nodeCount, connectionCount) {
    const total = nodeCount + connectionCount;
    if (total <= 5)
        return 'Low';
    if (total <= 12)
        return 'Medium';
    return 'High';
}
/**
 * Recalculates itemCount, complexity, and updates lastAccess on an Idea.
 */
async function syncIdeaMetadata(ideaId) {
    const [nodeCount, connectionCount] = await Promise.all([
        prisma_js_1.prisma.ideaNode.count({ where: { ideaId } }),
        prisma_js_1.prisma.ideaConnection.count({ where: { ideaId } }),
    ]);
    const complexity = computeComplexity(nodeCount, connectionCount);
    return prisma_js_1.prisma.idea.update({
        where: { id: ideaId },
        data: {
            itemCount: nodeCount,
            complexity,
            lastAccess: new Date(),
        },
    });
}
