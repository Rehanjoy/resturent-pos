# Environment Variable Registry — Saffron

Every environment variable used anywhere in the codebase is logged here the moment it's introduced, per `coding-standards.md`. Values shown are placeholders — never real secrets. Copy `.env.example` → `.env` in each app folder and fill in real values locally; `.env` files are git-ignored.

## backend/.env

| Variable | Used by | Purpose | Where to get the value |
|---|---|---|---|
| `NODE_ENV` | `src/config/env.ts`, `src/middleware/error-handler.ts` | Switches error verbosity (stack traces hidden in production) and other environment-specific behavior. | Set manually: `development`, `test`, or `production`. |
| `PORT` | `src/server.ts` | Port the Express + Socket.io HTTP server listens on. | Pick any free local port; default `5000`. |
| `MONGODB_URI` | `src/config/db.ts` | Mongoose connection string for the MongoDB database. | Local dev: a local `mongod` instance (`mongodb://127.0.0.1:27017/saffron`). Staging/production: connection string from the MongoDB Atlas cluster's "Connect" dialog (or self-hosted MongoDB admin). |
| `CORS_ORIGIN` | `src/app.ts`, `src/sockets/index.ts` | Restricts which browser origin may call the API / connect to Socket.io with credentials. Must exactly match the frontend's URL (protocol + host + port). | Local dev: `http://localhost:3000` (the frontend's dev server). Staging/production: the deployed frontend's URL. |

## frontend/.env.local (from `frontend/.env.example`)

| Variable | Used by | Purpose | Where to get the value |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `lib/api.ts` | Base URL the frontend's single API client calls for every backend request. `NEXT_PUBLIC_` prefix means it's exposed to the browser — never put secrets in a `NEXT_PUBLIC_` var. | Local dev: `http://localhost:5000` (the backend's dev server). Staging/production: the deployed backend's URL. |

## Adding a new variable

1. Add it to the relevant `.env.example` with a placeholder value (never a real secret).
2. Add a row to the table above: name, used by (file/module), purpose, where to obtain the value.
3. If it's a secret (API key, DB password, JWT signing key, etc.), confirm it is **not** prefixed `NEXT_PUBLIC_` on the frontend and is never logged or returned in API responses.
