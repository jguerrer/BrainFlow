# BrainFlow

A visual project and idea organizer built with **React + TypeScript + Custom SVG** on the frontend and **Node.js + Express + Prisma** on the backend.

## Features Implemented
- **Projects & Ideas Sidebar**: Organize multiple drawing canvases ("Ideas") under Projects, tracking **name**, **last access**, **item count**, and **complexity** (`Low` / `Medium` / `High`).
- **Project Resources**: Store and open reference links per project.
- **Custom SVG Drawing Canvas**:
  - Drag and drop new **Idea Boxes** onto the canvas or use the `+ Idea Box` tool.
  - Move boxes freely and change colors (`Toolbar` or `Inspector`).
  - Draw **Directed Connections** that automatically snap to target objects on touch/hover and anchor cleanly to box perimeters.
  - **Zoom** (mouse wheel or `+`/`-`/`Reset` buttons) and **Pan** (drag background).
- **Connectivity Cardinality Highlighting**: Highlight nodes by degree (`0` Isolated, `1–2` Linked, `3+` Hub) or filter to focus on Hubs or Isolated ideas.
- **Properties, Action Links & Delete**: Attach clickable action URLs to any Idea Box or Directed Connection, add custom key-value properties to connections, and delete objects or connections (with `Delete`/`Backspace` or Inspector button).

## Running Locally

1. **Install root helper** (optional, for running both servers together):
   ```bash
   npm install
   ```
2. **Start both Backend (`:3001`) and Frontend (`:5173`)**:
   ```bash
   npm run dev
   ```
   Then open `http://localhost:5173`.

## Database Persistence & Upgrading to PostgreSQL
- Currently configured with **SQLite** (`server/prisma/dev.db`) via Prisma ORM for zero-setup local persistence.
- To upgrade to **PostgreSQL** later:
  1. Open `server/prisma/schema.prisma` and change `provider = "sqlite"` to `provider = "postgresql"`.
  2. Update `DATABASE_URL` in `server/.env` to your PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/brainflow`).
  3. Run `npx prisma db push` inside `server/`.
