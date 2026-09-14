# QRwik — Restaurant POS & Management Platform

Client: digitecweb. Full product context lives in `docs/` (PRD, product brief, brand kit, wireframes).

This is two **separate codebases** in one repo — `frontend/` (Next.js) and `backend/` (Node.js/Express) — deployed and run independently. Neither depends on the other's build output; they only talk over HTTP/WebSocket at runtime.

```
resturent-pos/
├── frontend/        # Next.js App Router (TypeScript, Tailwind CSS)
├── backend/         # Node.js + Express API (TypeScript, MongoDB, Socket.io)
├── docs/            # PRD, brand kit, wireframes, env registry
└── assets/          # Source logo files
```

## Prerequisites

- Node.js 20+ and npm
- A MongoDB instance reachable from your machine (local `mongod`, Docker, or Atlas)

## Backend — `backend/`

```bash
cd backend
npm install
cp .env.example .env      # fill in MONGODB_URI etc. — see docs/env-registry.md
npm run dev                # http://localhost:5000
```

Scripts: `npm run dev` (watch mode), `npm run build` (compile to `dist/`), `npm start` (run compiled build), `npm run typecheck`.

Health check: `GET http://localhost:5000/api/health` → `{ "status": "ok" }`.

## Frontend — `frontend/`

```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL — see docs/env-registry.md
npm run dev                   # http://localhost:3000
```

Scripts: `npm run dev`, `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`.

Route groups (see `docs/00-prd-source.md` §5.2):

- `/` — public restaurant website (placeholder, built in Phase 2 — Website Builder module)
- `/admin` — POS / Dashboard / all staff-facing screens (wireframes in `docs/03-wireframes/`)
- `/order/[tableId]` — QR self-ordering PWA (placeholder, built in Phase 2)

## Ports

| App | Default port | Env var that must match it |
|---|---|---|
| Backend (Express + Socket.io) | `5000` | `CORS_ORIGIN` on the backend must equal the frontend's URL |
| Frontend (Next.js) | `3000` | `NEXT_PUBLIC_API_BASE_URL` on the frontend must equal the backend's URL |

If port `3000` or `5000` is already taken locally, Next.js will pick the next free port automatically — update `CORS_ORIGIN` (backend) and `NEXT_PUBLIC_API_BASE_URL` (frontend) to match whatever ports you actually run on.

## Environment variables

Every env var used in this project is documented in [`docs/env-registry.md`](docs/env-registry.md) — name, purpose, and where to obtain the value. Each app also has its own `.env.example` with the same variables as placeholders. Never commit a real `.env` file.

## Project status

This is the initial scaffold (routing, styling, DB/Socket.io wiring, health check). Auth, RBAC, and feature modules (Tables, Orders, KDS, Billing, Menu, Staff, Reports, etc.) are built in subsequent parts — see `docs/01-product-brief.md` §8 for the milestone order.
