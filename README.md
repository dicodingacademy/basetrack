# basetrack

A web app that turns Basecamp 4 To-dos into a live timer. Start a timer on a To-do, walk away, and the session is auto-stopped, persisted, and submitted to your Basecamp Timesheet — no manual entry.

See [`docs/PRD.md`](docs/PRD.md) for the full product spec and [`docs/TASKS.md`](docs/TASKS.md) for the implementation breakdown.

## Services

| Service        | Description                          | Port |
|----------------|--------------------------------------|------|
| `apps/tracker` | React Router v7 app (UI + API)       | 3000 |
| `apps/ws`      | Standalone WebSocket server          | 3001 |
| `packages/db`  | Prisma schema + generated client     | —    |
| `db`           | PostgreSQL (via docker-compose)      | 5432 |

## Quick start

```bash
docker compose up -d db
npm install
npm run db:migrate
npm run dev
```

## Docs

- [PRD](docs/PRD.md)
- [Implementation tasks](docs/TASKS.md)
- [Basecamp 4 API reference](docs/basecamp-api/)
