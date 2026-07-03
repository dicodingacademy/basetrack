<a id="readme-top"></a>

<div align="center">

# Basetrack

**Seamless time tracking for Basecamp.**
Never lose track of your hours. Automatically sync your time to Basecamp with a unified, flow-oriented dashboard.

[![Node][node-shield]][node-url]
[![React Router][remix-shield]][remix-url]
[![Prisma][prisma-shield]][prisma-url]
[![PostgreSQL][postgres-shield]][postgres-url]

[Report Bug][issues-url] · [Request Feature][issues-url]

</div>

---

## Why this exists

Basetrack solves the friction of tracking time directly inside Basecamp. Instead of switching tabs, manually calculating hours, or forgetting to stop a timer, Basetrack integrates natively via OAuth2 to provide a frictionless time-tracking experience.

| Feature | Basecamp Native | Basetrack |
|---|---|---|
| Live Timer | No | Yes — instant optimistic UI |
| Auto-stop | No | Yes — configurable threshold (e.g., 8 hours) |
| Approval Workflow | No | Yes — review auto-stopped timers before syncing |
| Data Persistence | Cloud only | Local PostgreSQL cache & sync |
| Multi-tab Sync | No | Yes — single source of truth |

<details>
<summary>Table of contents</summary>

- [Why this exists](#why-this-exists)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Workspace Structure](#workspace-structure)
- [Contributing](#contributing)

</details>

---

## Architecture

Basetrack utilizes a modern monorepo architecture divided into distinct micro-apps and packages, running on Node.js and PostgreSQL.

```
┌────────────────────┐   ┌──────────────────────────┐
│  React Router v8   │   │     Worker / Cron         │
│  (Tracker App)     │   │   (Standalone service)    │
│                    │   │                           │
│  - Auth (OAuth2)   │   │  - Berjalan tiap menit    │
│  - API routes      │   │  - Cek ActiveTimer > X hr │
│  - Prisma Client   │   │  - Stop ke NEEDS_APPROVAL │
└────────────────────┘   └──────────────────────────┘
             │                         │
             └──────────┬──────────────┘
                        ▼
            ┌────────────────────────┐
            │   PostgreSQL (Prisma)  │
            │   (Database package)   │
            └────────────────────────┘
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Prerequisites

- **Node.js 22.22.0+** — Required for React Router v8
- **PostgreSQL 15+** — Database engine
- **Docker + Docker Compose** — For quick database provisioning

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Installation

### 1. Database Setup

Spin up the local PostgreSQL database using the provided Docker Compose configuration:

```bash
docker compose up -d
```

### 2. Install Dependencies

Install all monorepo dependencies from the root directory:

```bash
npm install
```

### 3. Environment Variables

Create `.env` files in `packages/db` and `apps/tracker`:

**packages/db/.env**
```env
DATABASE_URL="postgresql://basetrack:basetrack@localhost:5433/basetrack?schema=public"
```

**apps/tracker/.env**
```env
SESSION_SECRET="your-super-secret-session-key"
BASECAMP_CLIENT_ID="your-basecamp-client-id"
BASECAMP_CLIENT_SECRET="your-basecamp-client-secret"
BASECAMP_REDIRECT_URI="http://localhost:5173/auth/basecamp/callback"
```

### 4. Database Migration

Push the schema to your local database and generate the Prisma Client:

```bash
npm run db:migrate
npm run db:generate --workspace=@basetrack/db
```

### 5. Start Development Servers

Run the development servers concurrently (React Router UI + Node Cron Worker):

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Workspace Structure

This project uses npm workspaces to manage dependencies across multiple packages.

| Package / App | Location | Description |
|---|---|---|
| `apps-tracker` | `apps/tracker` | Main frontend and API server (React Router v8). Handles OAuth, UI, and user sessions. |
| `@basetrack/cron` | `apps/cron` | Background Node.js worker. Checks for orphaned timers and marks them for manual approval. |
| `@basetrack/db` | `packages/db` | Shared Prisma ORM layer. Contains `schema.prisma`, migrations, and generated client. |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Bug reports and feature requests are welcome. For code changes:

```bash
npm install                 # root dev tooling
npm run lint -w apps-tracker # type-aware lint across the tracker app
npm run typecheck -w apps-tracker # tsc --noEmit
```

Keep pull requests scoped to one change, and make sure `lint` and `typecheck` pass before submitting.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[node-shield]: https://img.shields.io/badge/node-%E2%89%A522.22.0-339933?style=flat-square&logo=node.js&logoColor=white
[node-url]: https://nodejs.org
[remix-shield]: https://img.shields.io/badge/React%20Router-v8-CA4245?style=flat-square&logo=react-router&logoColor=white
[remix-url]: https://reactrouter.com/
[prisma-shield]: https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma&logoColor=white
[prisma-url]: https://www.prisma.io/
[postgres-shield]: https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql&logoColor=white
[postgres-url]: https://www.postgresql.org/
[issues-url]: https://github.com/alfianyusufabdullah/basetrack/issues
