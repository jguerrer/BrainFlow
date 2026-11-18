"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceRouter = void 0;
const express_1 = require("express");
const prisma_js_1 = require("../db/prisma.js");
exports.workspaceRouter = (0, express_1.Router)();
// GET /api/workspace - return last active project, idea, and UI mode
exports.workspaceRouter.get('/workspace', async (_req, res) => {
    const state = await prisma_js_1.prisma.workspaceState.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, cardinalityMode: 'degree' },
    });
    res.json(state);
});
// PATCH /api/workspace - update last active project, idea, or cardinalityMode
exports.workspaceRouter.patch('/workspace', async (req, res) => {
    const data = {};
    if (req.body?.lastProjectId === null || Number.isInteger(req.body?.lastProjectId)) {
        data.lastProjectId = req.body.lastProjectId;
    }
    if (req.body?.lastIdeaId === null || Number.isInteger(req.body?.lastIdeaId)) {
        data.lastIdeaId = req.body.lastIdeaId;
    }
    if (typeof req.body?.cardinalityMode === 'string' && req.body.cardinalityMode.trim()) {
        data.cardinalityMode = req.body.cardinalityMode.trim();
    }
    const state = await prisma_js_1.prisma.workspaceState.upsert({
        where: { id: 1 },
        update: data,
        create: {
            id: 1,
            lastProjectId: data.lastProjectId ?? null,
            lastIdeaId: data.lastIdeaId ?? null,
            cardinalityMode: data.cardinalityMode ?? 'degree',
        },
    });
    res.json(state);
});
