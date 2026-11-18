"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canvasRouter = void 0;
const express_1 = require("express");
const prisma_js_1 = require("../db/prisma.js");
const ideaMetadata_js_1 = require("../utils/ideaMetadata.js");
exports.canvasRouter = (0, express_1.Router)();
// POST /api/ideas/:ideaId/nodes - create a new idea object on the canvas
exports.canvasRouter.post('/ideas/:ideaId/nodes', async (req, res) => {
    const ideaId = Number(req.params.ideaId);
    if (!Number.isInteger(ideaId)) {
        res.status(400).json({ error: 'Invalid idea ID.' });
        return;
    }
    const isGroup = Boolean(req.body?.isGroup);
    const groupNodeIds = Array.isArray(req.body?.groupNodeIds)
        ? req.body.groupNodeIds.filter((id) => typeof id === 'number')
        : [];
    const defaultLabel = isGroup ? 'New Group' : 'New Idea';
    const label = typeof req.body?.label === 'string' && req.body.label.trim()
        ? req.body.label.trim()
        : defaultLabel;
    const description = typeof req.body?.description === 'string' ? req.body.description : '';
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    const x = typeof req.body?.x === 'number' ? req.body.x : 100;
    const y = typeof req.body?.y === 'number' ? req.body.y : 100;
    const defaultW = isGroup ? 360 : 156;
    const defaultH = isGroup ? 240 : 68;
    const width = typeof req.body?.width === 'number' ? req.body.width : defaultW;
    const height = typeof req.body?.height === 'number' ? req.body.height : defaultH;
    const defaultColor = isGroup ? '#8b5cf6' : '#3b82f6';
    const color = typeof req.body?.color === 'string' ? req.body.color : defaultColor;
    const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];
    const baseInputPort = req.body?.inputPort && typeof req.body.inputPort === 'object'
        ? req.body.inputPort
        : { label: '', description: '', actions: [], side: 'left' };
    const inputPort = isGroup
        ? { ...baseInputPort, isGroup: true, nodeIds: groupNodeIds }
        : baseInputPort;
    const outputPort = req.body?.outputPort && typeof req.body.outputPort === 'object'
        ? req.body.outputPort
        : { label: '', description: '', actions: [], side: 'right' };
    const node = await prisma_js_1.prisma.ideaNode.create({
        data: {
            ideaId,
            label,
            description,
            imageUrl,
            x,
            y,
            width,
            height,
            color,
            actions,
            inputPort,
            outputPort,
        },
    });
    const idea = await (0, ideaMetadata_js_1.syncIdeaMetadata)(ideaId);
    res.status(201).json({ node: (0, ideaMetadata_js_1.formatNodeForClient)(node), idea });
});
// PATCH /api/nodes/:id - update node position, label, description, imageUrl, color, or action links
exports.canvasRouter.patch('/nodes/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid node ID.' });
        return;
    }
    const data = {};
    if (typeof req.body?.label === 'string')
        data.label = req.body.label;
    if (typeof req.body?.description === 'string')
        data.description = req.body.description;
    if (typeof req.body?.imageUrl === 'string')
        data.imageUrl = req.body.imageUrl.trim();
    if (typeof req.body?.x === 'number')
        data.x = req.body.x;
    if (typeof req.body?.y === 'number')
        data.y = req.body.y;
    if (typeof req.body?.width === 'number')
        data.width = req.body.width;
    if (typeof req.body?.height === 'number')
        data.height = req.body.height;
    if (typeof req.body?.color === 'string')
        data.color = req.body.color;
    if (Array.isArray(req.body?.actions))
        data.actions = req.body.actions;
    if (req.body?.inputPort && typeof req.body.inputPort === 'object') {
        data.inputPort = req.body.inputPort;
    }
    if (req.body?.outputPort && typeof req.body.outputPort === 'object') {
        data.outputPort = req.body.outputPort;
    }
    if (typeof req.body?.isGroup === 'boolean' || Array.isArray(req.body?.groupNodeIds)) {
        const existingNode = await prisma_js_1.prisma.ideaNode.findUnique({ where: { id } });
        const currentPort = (existingNode?.inputPort && typeof existingNode.inputPort === 'object' && !Array.isArray(existingNode.inputPort))
            ? existingNode.inputPort
            : { label: '', description: '', actions: [], side: 'left' };
        const basePort = (data.inputPort && typeof data.inputPort === 'object' && !Array.isArray(data.inputPort))
            ? data.inputPort
            : currentPort;
        data.inputPort = {
            ...basePort,
            ...(typeof req.body?.isGroup === 'boolean' ? { isGroup: req.body.isGroup } : {}),
            ...(Array.isArray(req.body?.groupNodeIds) ? { nodeIds: req.body.groupNodeIds } : {}),
        };
    }
    const node = await prisma_js_1.prisma.ideaNode.update({
        where: { id },
        data,
    });
    const idea = await (0, ideaMetadata_js_1.syncIdeaMetadata)(node.ideaId);
    res.json({ node: (0, ideaMetadata_js_1.formatNodeForClient)(node), idea });
});
// DELETE /api/nodes/:id - delete a node (cascades its connections)
exports.canvasRouter.delete('/nodes/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid node ID.' });
        return;
    }
    const existing = await prisma_js_1.prisma.ideaNode.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'Node not found.' });
        return;
    }
    await prisma_js_1.prisma.ideaNode.delete({ where: { id } });
    const idea = await (0, ideaMetadata_js_1.syncIdeaMetadata)(existing.ideaId);
    res.json({ deletedNodeId: id, idea });
});
const VALID_PORT_SIDES = new Set(['left', 'right', 'top', 'bottom']);
function normalizeSide(raw, fallback) {
    return typeof raw === 'string' && VALID_PORT_SIDES.has(raw) ? raw : fallback;
}
// POST /api/ideas/:ideaId/connections - create a directed connection between two nodes
exports.canvasRouter.post('/ideas/:ideaId/connections', async (req, res) => {
    const ideaId = Number(req.params.ideaId);
    const fromNodeId = Number(req.body?.fromNodeId);
    const toNodeId = Number(req.body?.toNodeId);
    if (!Number.isInteger(ideaId) || !Number.isInteger(fromNodeId) || !Number.isInteger(toNodeId)) {
        res.status(400).json({ error: 'Valid ideaId, fromNodeId, and toNodeId are required.' });
        return;
    }
    if (fromNodeId === toNodeId) {
        res.status(400).json({ error: 'Self-connections are not allowed.' });
        return;
    }
    const fromSide = normalizeSide(req.body?.fromSide, 'right');
    const toSide = normalizeSide(req.body?.toSide, 'left');
    const bidirectional = Boolean(req.body?.bidirectional);
    const label = typeof req.body?.label === 'string' && req.body.label.trim()
        ? req.body.label.trim()
        : 'connects';
    const color = typeof req.body?.color === 'string' ? req.body.color : '#3b82f6';
    const properties = req.body?.properties && typeof req.body.properties === 'object'
        ? req.body.properties
        : {};
    const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];
    const labelOffsetX = typeof req.body?.labelOffsetX === 'number' ? req.body.labelOffsetX : 0;
    const labelOffsetY = typeof req.body?.labelOffsetY === 'number' ? req.body.labelOffsetY : 0;
    const labelWidth = typeof req.body?.labelWidth === 'number' && req.body.labelWidth >= 40
        ? req.body.labelWidth
        : 96;
    const labelHeight = typeof req.body?.labelHeight === 'number' && req.body.labelHeight >= 20
        ? req.body.labelHeight
        : 24;
    const connection = await prisma_js_1.prisma.ideaConnection.create({
        data: {
            ideaId,
            fromNodeId,
            toNodeId,
            fromSide,
            toSide,
            bidirectional,
            label,
            color,
            properties,
            actions,
            labelOffsetX,
            labelOffsetY,
            labelWidth,
            labelHeight,
        },
    });
    const idea = await (0, ideaMetadata_js_1.syncIdeaMetadata)(ideaId);
    res.status(201).json({ connection, idea });
});
// PATCH /api/connections/:id - update connection label, color, sides, properties, actions, or label box geometry
exports.canvasRouter.patch('/connections/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid connection ID.' });
        return;
    }
    const data = {};
    if (typeof req.body?.fromSide === 'string' && VALID_PORT_SIDES.has(req.body.fromSide)) {
        data.fromSide = req.body.fromSide;
    }
    if (typeof req.body?.toSide === 'string' && VALID_PORT_SIDES.has(req.body.toSide)) {
        data.toSide = req.body.toSide;
    }
    if (typeof req.body?.bidirectional === 'boolean') {
        data.bidirectional = req.body.bidirectional;
    }
    if (typeof req.body?.label === 'string')
        data.label = req.body.label;
    if (typeof req.body?.color === 'string')
        data.color = req.body.color;
    if (req.body?.properties && typeof req.body.properties === 'object') {
        data.properties = req.body.properties;
    }
    if (Array.isArray(req.body?.actions))
        data.actions = req.body.actions;
    if (typeof req.body?.labelOffsetX === 'number')
        data.labelOffsetX = req.body.labelOffsetX;
    if (typeof req.body?.labelOffsetY === 'number')
        data.labelOffsetY = req.body.labelOffsetY;
    if (typeof req.body?.labelWidth === 'number')
        data.labelWidth = Math.max(40, req.body.labelWidth);
    if (typeof req.body?.labelHeight === 'number')
        data.labelHeight = Math.max(20, req.body.labelHeight);
    const connection = await prisma_js_1.prisma.ideaConnection.update({
        where: { id },
        data,
    });
    const idea = await (0, ideaMetadata_js_1.syncIdeaMetadata)(connection.ideaId);
    res.json({ connection, idea });
});
// DELETE /api/connections/:id - delete a directed connection
exports.canvasRouter.delete('/connections/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid connection ID.' });
        return;
    }
    const existing = await prisma_js_1.prisma.ideaConnection.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'Connection not found.' });
        return;
    }
    await prisma_js_1.prisma.ideaConnection.delete({ where: { id } });
    const idea = await (0, ideaMetadata_js_1.syncIdeaMetadata)(existing.ideaId);
    res.json({ deletedConnectionId: id, idea });
});
