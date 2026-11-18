import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { projectsRouter } from './routes/projects.routes.js';
import { ideasRouter } from './routes/ideas.routes.js';
import { canvasRouter } from './routes/canvas.routes.js';
import { workspaceRouter } from './routes/workspace.routes.js';
import { transferRouter } from './routes/transfer.routes.js';
import { seedIfEmpty } from './db/seed.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', projectsRouter);
app.use('/api', ideasRouter);
app.use('/api', canvasRouter);
app.use('/api', workspaceRouter);
app.use('/api', transferRouter);

// Basic centralized error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await seedIfEmpty();
  app.listen(PORT, () => {
    console.log(`BrainFlow server running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start BrainFlow server:', err);
  process.exit(1);
});
