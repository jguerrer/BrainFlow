import { Router } from 'express';
import { prisma } from '../db/prisma.js';

export const workspaceRouter = Router();

// GET /api/workspace - return last active project, idea, and UI mode
workspaceRouter.get('/workspace', async (_req, res) => {
  const state = await prisma.workspaceState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, cardinalityMode: 'degree' },
  });
  res.json(state);
});

// PATCH /api/workspace - update last active project, idea, or cardinalityMode
workspaceRouter.patch('/workspace', async (req, res) => {
  const data: {
    lastProjectId?: number | null;
    lastIdeaId?: number | null;
    cardinalityMode?: string;
  } = {};

  if (req.body?.lastProjectId === null || Number.isInteger(req.body?.lastProjectId)) {
    data.lastProjectId = req.body.lastProjectId;
  }
  if (req.body?.lastIdeaId === null || Number.isInteger(req.body?.lastIdeaId)) {
    data.lastIdeaId = req.body.lastIdeaId;
  }
  if (typeof req.body?.cardinalityMode === 'string' && req.body.cardinalityMode.trim()) {
    data.cardinalityMode = req.body.cardinalityMode.trim();
  }

  const state = await prisma.workspaceState.upsert({
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
