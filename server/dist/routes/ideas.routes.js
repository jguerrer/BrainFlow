"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ideasRouter = void 0;
const express_1 = require("express");
const prisma_js_1 = require("../db/prisma.js");
const ideaMetadata_js_1 = require("../utils/ideaMetadata.js");
exports.ideasRouter = (0, express_1.Router)();
// GET /api/ideas/:id - fetch a single idea with nodes & connections, and touch lastAccess
exports.ideasRouter.get('/ideas/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid idea ID.' });
        return;
    }
    const existing = await prisma_js_1.prisma.idea.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'Idea not found.' });
        return;
    }
    const idea = await prisma_js_1.prisma.idea.update({
        where: { id },
        data: { lastAccess: new Date() },
        include: {
            nodes: { orderBy: { id: 'asc' } },
            connections: { orderBy: { id: 'asc' } },
        },
    });
    await prisma_js_1.prisma.workspaceState.upsert({
        where: { id: 1 },
        update: { lastProjectId: idea.projectId, lastIdeaId: idea.id },
        create: { id: 1, lastProjectId: idea.projectId, lastIdeaId: idea.id, cardinalityMode: 'degree' },
    });
    res.json({
        ...idea,
        nodes: idea.nodes.map(ideaMetadata_js_1.formatNodeForClient),
    });
});
// POST /api/projects/:projectId/ideas - create a new idea drawing under a project
exports.ideasRouter.post('/projects/:projectId/ideas', async (req, res) => {
    const projectId = Number(req.params.projectId);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!Number.isInteger(projectId) || !name) {
        res.status(400).json({ error: 'Valid project ID and idea name are required.' });
        return;
    }
    const idea = await prisma_js_1.prisma.idea.create({
        data: {
            projectId,
            name,
            description: typeof req.body?.description === 'string' ? req.body.description : '',
            itemCount: 0,
            complexity: 'Low',
        },
        include: { nodes: true, connections: true },
    });
    await prisma_js_1.prisma.workspaceState.upsert({
        where: { id: 1 },
        update: { lastProjectId: idea.projectId, lastIdeaId: idea.id },
        create: { id: 1, lastProjectId: idea.projectId, lastIdeaId: idea.id, cardinalityMode: 'degree' },
    });
    res.status(201).json({
        ...idea,
        nodes: idea.nodes.map(ideaMetadata_js_1.formatNodeForClient),
    });
});
// PATCH /api/ideas/:id - update idea name, description, complexity, or viewport
exports.ideasRouter.patch('/ideas/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid idea ID.' });
        return;
    }
    const data = {
        lastAccess: new Date(),
    };
    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
        data.name = req.body.name.trim();
    }
    if (typeof req.body?.description === 'string') {
        data.description = req.body.description;
    }
    if (typeof req.body?.complexity === 'string' && req.body.complexity.trim()) {
        data.complexity = req.body.complexity.trim();
    }
    if (typeof req.body?.isStashed === 'boolean') {
        data.isStashed = req.body.isStashed;
    }
    if (typeof req.body?.zoom === 'number' && Number.isFinite(req.body.zoom)) {
        data.zoom = req.body.zoom;
    }
    if (typeof req.body?.panX === 'number' && Number.isFinite(req.body.panX)) {
        data.panX = req.body.panX;
    }
    if (typeof req.body?.panY === 'number' && Number.isFinite(req.body.panY)) {
        data.panY = req.body.panY;
    }
    const idea = await prisma_js_1.prisma.idea.update({
        where: { id },
        data,
    });
    res.json(idea);
});
// DELETE /api/ideas/:id - delete an idea drawing
exports.ideasRouter.delete('/ideas/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid idea ID.' });
        return;
    }
    await prisma_js_1.prisma.idea.delete({ where: { id } });
    res.status(204).end();
});
