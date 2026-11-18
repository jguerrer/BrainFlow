"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const projects_routes_js_1 = require("./routes/projects.routes.js");
const ideas_routes_js_1 = require("./routes/ideas.routes.js");
const canvas_routes_js_1 = require("./routes/canvas.routes.js");
const workspace_routes_js_1 = require("./routes/workspace.routes.js");
const transfer_routes_js_1 = require("./routes/transfer.routes.js");
const seed_js_1 = require("./db/seed.js");
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api', projects_routes_js_1.projectsRouter);
app.use('/api', ideas_routes_js_1.ideasRouter);
app.use('/api', canvas_routes_js_1.canvasRouter);
app.use('/api', workspace_routes_js_1.workspaceRouter);
app.use('/api', transfer_routes_js_1.transferRouter);
// Basic centralized error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
async function start() {
    await (0, seed_js_1.seedIfEmpty)();
    app.listen(PORT, () => {
        console.log(`BrainFlow server running at http://localhost:${PORT}`);
    });
}
start().catch((err) => {
    console.error('Failed to start BrainFlow server:', err);
    process.exit(1);
});
