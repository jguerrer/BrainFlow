import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { computeComplexity } from '../utils/ideaMetadata.js';

export const transferRouter = Router();

const VALID_SIDES = new Set(['left', 'right', 'top', 'bottom']);

function safeSide(value: unknown, fallback: string): string {
  return typeof value === 'string' && VALID_SIDES.has(value) ? value : fallback;
}

function safeNum(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeJsonObject(value: unknown, fallback: Prisma.InputJsonObject): Prisma.InputJsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Prisma.InputJsonObject)
    : fallback;
}

function safeJsonArray(value: unknown): Prisma.InputJsonArray {
  return Array.isArray(value) ? (value as Prisma.InputJsonArray) : [];
}

function serializeIdea(idea: {
  name: string;
  description: string;
  complexity: string;
  isStashed: boolean;
  zoom: number;
  panX: number;
  panY: number;
  nodes: Array<{
    id: number;
    label: string;
    description: string;
    imageUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    actions: unknown;
    inputPort: unknown;
    outputPort: unknown;
  }>;
  connections: Array<{
    fromNodeId: number;
    toNodeId: number;
    fromSide: string;
    toSide: string;
    bidirectional: boolean;
    label: string;
    labelOffsetX: number;
    labelOffsetY: number;
    labelWidth: number;
    labelHeight: number;
    color: string;
    properties: unknown;
    actions: unknown;
  }>;
}) {
  return {
    name: idea.name,
    description: idea.description,
    complexity: idea.complexity,
    isStashed: idea.isStashed,
    zoom: idea.zoom,
    panX: idea.panX,
    panY: idea.panY,
    nodes: idea.nodes.map((node) => {
      const port =
        node.inputPort && typeof node.inputPort === 'object' && !Array.isArray(node.inputPort)
          ? (node.inputPort as Record<string, unknown>)
          : {};
      return {
        refId: `node-${node.id}`,
        label: node.label,
        description: node.description,
        imageUrl: node.imageUrl ?? '',
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        color: node.color,
        isGroup: Boolean(port.isGroup),
        groupNodeIds: Array.isArray(port.nodeIds) ? port.nodeIds : [],
        actions: Array.isArray(node.actions) ? node.actions : [],
        inputPort: node.inputPort ?? { label: '', description: '', actions: [], side: 'left' },
        outputPort: node.outputPort ?? { label: '', description: '', actions: [], side: 'right' },
      };
    }),
    connections: idea.connections.map((conn) => ({
      fromRefId: `node-${conn.fromNodeId}`,
      toRefId: `node-${conn.toNodeId}`,
      fromSide: conn.fromSide,
      toSide: conn.toSide,
      bidirectional: conn.bidirectional,
      label: conn.label,
      labelOffsetX: conn.labelOffsetX,
      labelOffsetY: conn.labelOffsetY,
      labelWidth: conn.labelWidth,
      labelHeight: conn.labelHeight,
      color: conn.color,
      properties:
        conn.properties && typeof conn.properties === 'object' && !Array.isArray(conn.properties)
          ? conn.properties
          : {},
      actions: Array.isArray(conn.actions) ? conn.actions : [],
    })),
  };
}

async function importIdeaIntoProject(
  tx: Prisma.TransactionClient,
  projectId: number,
  rawIdea: Record<string, unknown>
) {
  const name =
    typeof rawIdea.name === 'string' && rawIdea.name.trim()
      ? rawIdea.name.trim()
      : 'Imported Idea';
  const description = typeof rawIdea.description === 'string' ? rawIdea.description : '';
  const isStashed = Boolean(rawIdea.isStashed);
  const zoom = Math.min(2.5, Math.max(0.3, safeNum(rawIdea.zoom, 1)));
  const panX = safeNum(rawIdea.panX, 0);
  const panY = safeNum(rawIdea.panY, 0);

  const rawNodes = Array.isArray(rawIdea.nodes)
    ? rawIdea.nodes.filter((n): n is Record<string, unknown> => Boolean(n && typeof n === 'object'))
    : [];
  const rawConnections = Array.isArray(rawIdea.connections)
    ? rawIdea.connections.filter(
        (c): c is Record<string, unknown> => Boolean(c && typeof c === 'object')
      )
    : [];

  const createdIdea = await tx.idea.create({
    data: {
      projectId,
      name,
      description,
      isStashed,
      zoom,
      panX,
      panY,
      itemCount: rawNodes.length,
      complexity: computeComplexity(rawNodes.length, rawConnections.length),
    },
  });

  const refMap = new Map<string, number>();

  for (let i = 0; i < rawNodes.length; i++) {
    const rawNode = rawNodes[i];
    const refId =
      typeof rawNode.refId === 'string' && rawNode.refId.trim()
        ? rawNode.refId.trim()
        : rawNode.id !== undefined
          ? String(rawNode.id)
          : `idx-${i}`;

    const createdNode = await tx.ideaNode.create({
      data: {
        ideaId: createdIdea.id,
        label:
          typeof rawNode.label === 'string' && rawNode.label.trim()
            ? rawNode.label.trim()
            : 'Imported Box',
        description: typeof rawNode.description === 'string' ? rawNode.description : '',
        imageUrl: typeof rawNode.imageUrl === 'string' ? rawNode.imageUrl.trim() : '',
        x: safeNum(rawNode.x, 120 + i * 40),
        y: safeNum(rawNode.y, 120 + i * 30),
        width: Math.max(80, safeNum(rawNode.width, 156)),
        height: Math.max(40, safeNum(rawNode.height, 68)),
        color: typeof rawNode.color === 'string' ? rawNode.color : '#3b82f6',
        actions: safeJsonArray(rawNode.actions),
        inputPort: Boolean((rawNode as any).isGroup)
          ? {
              ...safeJsonObject(rawNode.inputPort, {
                label: '',
                description: '',
                actions: [],
                side: 'left',
              }),
              isGroup: true,
              nodeIds: Array.isArray((rawNode as any).groupNodeIds) ? (rawNode as any).groupNodeIds : [],
            }
          : safeJsonObject(rawNode.inputPort, {
              label: '',
              description: '',
              actions: [],
              side: 'left',
            }),
        outputPort: safeJsonObject(rawNode.outputPort, {
          label: '',
          description: '',
          actions: [],
          side: 'right',
        }),
      },
    });

    refMap.set(refId, createdNode.id);
  }

  let validConnCount = 0;
  for (const rawConn of rawConnections) {
    const fromRef =
      typeof rawConn.fromRefId === 'string'
        ? rawConn.fromRefId.trim()
        : rawConn.fromNodeId !== undefined
          ? String(rawConn.fromNodeId)
          : '';
    const toRef =
      typeof rawConn.toRefId === 'string'
        ? rawConn.toRefId.trim()
        : rawConn.toNodeId !== undefined
          ? String(rawConn.toNodeId)
          : '';

    const fromNodeId = refMap.get(fromRef);
    const toNodeId = refMap.get(toRef);
    if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) continue;

    await tx.ideaConnection.create({
      data: {
        ideaId: createdIdea.id,
        fromNodeId,
        toNodeId,
        fromSide: safeSide(rawConn.fromSide, 'right'),
        toSide: safeSide(rawConn.toSide, 'left'),
        bidirectional: Boolean(rawConn.bidirectional),
        label:
          typeof rawConn.label === 'string' && rawConn.label.trim()
            ? rawConn.label.trim()
            : 'connects',
        labelOffsetX: safeNum(rawConn.labelOffsetX, 0),
        labelOffsetY: safeNum(rawConn.labelOffsetY, 0),
        labelWidth: Math.max(40, safeNum(rawConn.labelWidth, 96)),
        labelHeight: Math.max(20, safeNum(rawConn.labelHeight, 24)),
        color: typeof rawConn.color === 'string' ? rawConn.color : '#3b82f6',
        properties: safeJsonObject(rawConn.properties, {}),
        actions: safeJsonArray(rawConn.actions),
      },
    });
    validConnCount += 1;
  }

  return tx.idea.update({
    where: { id: createdIdea.id },
    data: {
      itemCount: rawNodes.length,
      complexity: computeComplexity(rawNodes.length, validConnCount),
    },
    include: {
      nodes: { orderBy: { id: 'asc' } },
      connections: { orderBy: { id: 'asc' } },
    },
  });
}

// GET /api/projects/:id/export - export full project bundle as portable JSON
transferRouter.get('/projects/:id/export', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid project ID.' });
    return;
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      resources: { orderBy: { createdAt: 'asc' } },
      ideas: {
        orderBy: { createdAt: 'asc' },
        include: {
          nodes: { orderBy: { id: 'asc' } },
          connections: { orderBy: { id: 'asc' } },
        },
      },
    },
  });

  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  res.json({
    format: 'brainflow-export',
    version: 1,
    kind: 'project',
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      resources: project.resources.map((r) => ({ title: r.title, url: r.url })),
      ideas: project.ideas.map(serializeIdea),
    },
  });
});

// GET /api/ideas/:id/export - export a single idea drawing as portable JSON
transferRouter.get('/ideas/:id/export', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid idea ID.' });
    return;
  }

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      nodes: { orderBy: { id: 'asc' } },
      connections: { orderBy: { id: 'asc' } },
    },
  });

  if (!idea) {
    res.status(404).json({ error: 'Idea not found.' });
    return;
  }

  res.json({
    format: 'brainflow-export',
    version: 1,
    kind: 'idea',
    exportedAt: new Date().toISOString(),
    idea: serializeIdea(idea),
  });
});

// POST /api/import - import either a full project bundle or a single idea bundle
transferRouter.post('/import', async (req, res) => {
  const rawBody = req.body;
  const bundle =
    rawBody && typeof rawBody === 'object' && rawBody.bundle && typeof rawBody.bundle === 'object'
      ? (rawBody.bundle as Record<string, unknown>)
      : (rawBody as Record<string, unknown> | null);

  if (
    !bundle ||
    bundle.format !== 'brainflow-export' ||
    bundle.version !== 1 ||
    (bundle.kind !== 'project' && bundle.kind !== 'idea')
  ) {
    res.status(400).json({
      error: 'Invalid BrainFlow JSON bundle. Expected format "brainflow-export", version 1.',
    });
    return;
  }

  if (bundle.kind === 'project') {
    const rawProject = bundle.project;
    if (!rawProject || typeof rawProject !== 'object') {
      res.status(400).json({ error: 'Missing "project" payload in export bundle.' });
      return;
    }

    const projectObj = rawProject as Record<string, unknown>;
    const baseName =
      typeof projectObj.name === 'string' && projectObj.name.trim()
        ? projectObj.name.trim()
        : 'Imported Project';
    const rawResources = Array.isArray(projectObj.resources) ? projectObj.resources : [];
    const rawIdeas = Array.isArray(projectObj.ideas)
      ? projectObj.ideas.filter((i): i is Record<string, unknown> => Boolean(i && typeof i === 'object'))
      : [];

    const result = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: { name: baseName },
      });

      for (const rawRes of rawResources) {
        if (!rawRes || typeof rawRes !== 'object') continue;
        const r = rawRes as Record<string, unknown>;
        const title = typeof r.title === 'string' ? r.title.trim() : '';
        const url = typeof r.url === 'string' ? r.url.trim() : '';
        if (!title || !url) continue;
        await tx.projectResource.create({
          data: { projectId: createdProject.id, title, url },
        });
      }

      const ideasToImport =
        rawIdeas.length > 0 ? rawIdeas : [{ name: 'Main Idea', nodes: [], connections: [] }];

      const createdIdeas = [];
      for (const rawIdea of ideasToImport) {
        createdIdeas.push(await importIdeaIntoProject(tx, createdProject.id, rawIdea));
      }

      const firstActive = createdIdeas.find((i) => !i.isStashed) ?? createdIdeas[0];
      if (firstActive) {
        await tx.workspaceState.upsert({
          where: { id: 1 },
          update: { lastProjectId: createdProject.id, lastIdeaId: firstActive.id },
          create: {
            id: 1,
            lastProjectId: createdProject.id,
            lastIdeaId: firstActive.id,
            cardinalityMode: 'degree',
          },
        });
      }

      const fullProject = await tx.project.findUniqueOrThrow({
        where: { id: createdProject.id },
        include: {
          resources: { orderBy: { createdAt: 'asc' } },
          ideas: { orderBy: { createdAt: 'asc' } },
        },
      });

      return {
        kind: 'project' as const,
        project: fullProject,
        activeIdeaId: firstActive?.id ?? null,
      };
    });

    res.status(201).json(result);
    return;
  }

  // kind === 'idea'
  const rawIdea = bundle.idea;
  if (!rawIdea || typeof rawIdea !== 'object') {
    res.status(400).json({ error: 'Missing "idea" payload in export bundle.' });
    return;
  }

  const requestedProjectId = Number(req.body?.targetProjectId);

  const result = await prisma.$transaction(async (tx) => {
    let targetProject =
      Number.isInteger(requestedProjectId)
        ? await tx.project.findUnique({ where: { id: requestedProjectId } })
        : null;

    if (!targetProject) {
      targetProject = await tx.project.findFirst({ orderBy: { createdAt: 'asc' } });
    }
    if (!targetProject) {
      targetProject = await tx.project.create({ data: { name: 'Imported Ideas' } });
    }

    const importedIdea = await importIdeaIntoProject(
      tx,
      targetProject.id,
      rawIdea as Record<string, unknown>
    );

    await tx.workspaceState.upsert({
      where: { id: 1 },
      update: { lastProjectId: targetProject.id, lastIdeaId: importedIdea.id },
      create: {
        id: 1,
        lastProjectId: targetProject.id,
        lastIdeaId: importedIdea.id,
        cardinalityMode: 'degree',
      },
    });

    return {
      kind: 'idea' as const,
      projectId: targetProject.id,
      idea: importedIdea,
    };
  });

  res.status(201).json(result);
});
