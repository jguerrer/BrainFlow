"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectsRouter = void 0;
const express_1 = require("express");
const prisma_js_1 = require("../db/prisma.js");
exports.projectsRouter = (0, express_1.Router)();
// GET /api/projects - list all projects with resources and idea summaries
exports.projectsRouter.get('/projects', async (_req, res) => {
    const projects = await prisma_js_1.prisma.project.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
            resources: { orderBy: { createdAt: 'asc' } },
            ideas: { orderBy: { createdAt: 'asc' } },
        },
    });
    res.json(projects);
});
// POST /api/projects - create a new project with a starter idea page
exports.projectsRouter.post('/projects', async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
        res.status(400).json({ error: 'Project name is required.' });
        return;
    }
    const project = await prisma_js_1.prisma.project.create({
        data: {
            name,
            ideas: {
                create: {
                    name: 'Main Idea',
                    itemCount: 0,
                    complexity: 'Low',
                },
            },
        },
        include: {
            resources: true,
            ideas: true,
        },
    });
    res.status(201).json(project);
});
// PATCH /api/projects/:id - rename a project
exports.projectsRouter.patch('/projects/:id', async (req, res) => {
    const id = Number(req.params.id);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!Number.isInteger(id) || !name) {
        res.status(400).json({ error: 'Valid project ID and name are required.' });
        return;
    }
    const project = await prisma_js_1.prisma.project.update({
        where: { id },
        data: { name },
        include: { resources: true, ideas: true },
    });
    res.json(project);
});
// DELETE /api/projects/:id - delete a project and its ideas/resources
exports.projectsRouter.delete('/projects/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid project ID.' });
        return;
    }
    await prisma_js_1.prisma.project.delete({ where: { id } });
    res.status(204).end();
});
// POST /api/projects/:id/resources - attach a resource link to a project
exports.projectsRouter.post('/projects/:id/resources', async (req, res) => {
    const projectId = Number(req.params.id);
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!Number.isInteger(projectId) || !title || !url) {
        res.status(400).json({ error: 'Project ID, title, and URL are required.' });
        return;
    }
    const resource = await prisma_js_1.prisma.projectResource.create({
        data: { projectId, title, url },
    });
    res.status(201).json(resource);
});
// DELETE /api/resources/:id - remove a project resource link
exports.projectsRouter.delete('/resources/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid resource ID.' });
        return;
    }
    await prisma_js_1.prisma.projectResource.delete({ where: { id } });
    res.status(204).end();
});
