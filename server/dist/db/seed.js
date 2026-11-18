"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedIfEmpty = seedIfEmpty;
const prisma_js_1 = require("./prisma.js");
async function seedIfEmpty() {
    const count = await prisma_js_1.prisma.project.count();
    if (count > 0)
        return;
    const project1 = await prisma_js_1.prisma.project.create({
        data: {
            name: 'SaaS Product Architecture',
            resources: {
                create: [
                    { title: 'React Documentation', url: 'https://react.dev' },
                    { title: 'Prisma Upgrade Guide', url: 'https://www.prisma.io/docs' },
                ],
            },
        },
    });
    const idea1 = await prisma_js_1.prisma.idea.create({
        data: {
            projectId: project1.id,
            name: 'Auth & User Flow',
            itemCount: 5,
            complexity: 'Medium',
        },
    });
    const n1 = await prisma_js_1.prisma.ideaNode.create({
        data: {
            ideaId: idea1.id,
            label: 'Web Client',
            x: 90,
            y: 120,
            color: '#3b82f6',
            actions: [{ label: 'UI Wireframes', url: 'https://figma.com' }],
        },
    });
    const n2 = await prisma_js_1.prisma.ideaNode.create({
        data: {
            ideaId: idea1.id,
            label: 'API Gateway',
            x: 340,
            y: 120,
            color: '#10b981',
            actions: [{ label: 'Express Docs', url: 'https://expressjs.com' }],
        },
    });
    const n3 = await prisma_js_1.prisma.ideaNode.create({
        data: {
            ideaId: idea1.id,
            label: 'Auth Service',
            x: 340,
            y: 270,
            color: '#8b5cf6',
            actions: [],
        },
    });
    const n4 = await prisma_js_1.prisma.ideaNode.create({
        data: {
            ideaId: idea1.id,
            label: 'Users DB',
            x: 590,
            y: 195,
            color: '#f59e0b',
            actions: [{ label: 'PostgreSQL Docs', url: 'https://www.postgresql.org/docs/' }],
        },
    });
    await prisma_js_1.prisma.ideaNode.create({
        data: {
            ideaId: idea1.id,
            label: 'Audit Logger',
            x: 90,
            y: 280,
            color: '#ec4899',
            actions: [],
        },
    });
    await prisma_js_1.prisma.ideaConnection.createMany({
        data: [
            {
                ideaId: idea1.id,
                fromNodeId: n1.id,
                toNodeId: n2.id,
                label: 'HTTPS / JWT',
                color: '#3b82f6',
                properties: { protocol: 'REST', auth: 'Bearer' },
                actions: [{ label: 'Inspect JWT', url: 'https://jwt.io' }],
            },
            {
                ideaId: idea1.id,
                fromNodeId: n2.id,
                toNodeId: n3.id,
                label: 'Verify Token',
                color: '#10b981',
                properties: { timeout: '200ms' },
                actions: [],
            },
            {
                ideaId: idea1.id,
                fromNodeId: n2.id,
                toNodeId: n4.id,
                label: 'Read Profile',
                color: '#f59e0b',
                properties: { cache: 'Enabled' },
                actions: [],
            },
            {
                ideaId: idea1.id,
                fromNodeId: n3.id,
                toNodeId: n4.id,
                label: 'Check Creds',
                color: '#8b5cf6',
                properties: { hash: 'bcrypt' },
                actions: [],
            },
        ],
    });
    const idea2 = await prisma_js_1.prisma.idea.create({
        data: {
            projectId: project1.id,
            name: 'Billing & Webhooks',
            itemCount: 2,
            complexity: 'Low',
        },
    });
    const b1 = await prisma_js_1.prisma.ideaNode.create({
        data: { ideaId: idea2.id, label: 'Checkout UI', x: 140, y: 150, color: '#3b82f6', actions: [] },
    });
    const b2 = await prisma_js_1.prisma.ideaNode.create({
        data: { ideaId: idea2.id, label: 'Payment Webhook', x: 400, y: 150, color: '#10b981', actions: [] },
    });
    await prisma_js_1.prisma.ideaConnection.create({
        data: {
            ideaId: idea2.id,
            fromNodeId: b1.id,
            toNodeId: b2.id,
            label: 'Payment Event',
            color: '#10b981',
            properties: { retry: '3x' },
            actions: [],
        },
    });
    const project2 = await prisma_js_1.prisma.project.create({
        data: {
            name: 'Learning Roadmap',
            resources: {
                create: [
                    { title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/' },
                ],
            },
        },
    });
    const idea3 = await prisma_js_1.prisma.idea.create({
        data: {
            projectId: project2.id,
            name: 'Full-Stack Fundamentals',
            itemCount: 3,
            complexity: 'Low',
        },
    });
    const l1 = await prisma_js_1.prisma.ideaNode.create({
        data: { ideaId: idea3.id, label: 'React + SVG', x: 140, y: 140, color: '#3b82f6', actions: [] },
    });
    const l2 = await prisma_js_1.prisma.ideaNode.create({
        data: { ideaId: idea3.id, label: 'Node + Express', x: 390, y: 140, color: '#10b981', actions: [] },
    });
    const l3 = await prisma_js_1.prisma.ideaNode.create({
        data: { ideaId: idea3.id, label: 'SQLite -> Postgres', x: 265, y: 275, color: '#f59e0b', actions: [] },
    });
    await prisma_js_1.prisma.ideaConnection.createMany({
        data: [
            {
                ideaId: idea3.id,
                fromNodeId: l1.id,
                toNodeId: l2.id,
                label: 'REST API',
                color: '#3b82f6',
                properties: { format: 'JSON' },
                actions: [],
            },
            {
                ideaId: idea3.id,
                fromNodeId: l2.id,
                toNodeId: l3.id,
                label: 'Prisma ORM',
                color: '#f59e0b',
                properties: { portable: 'true' },
                actions: [],
            },
        ],
    });
}
