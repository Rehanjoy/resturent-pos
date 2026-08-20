# Environment Variable Registry — Saffron

Every environment variable used anywhere in the codebase is logged here the moment it's introduced, per `coding-standards.md`. Values shown are placeholders — never real secrets. Copy `.env.example` → `.env` in each app folder and fill in real values locally; `.env` files are git-ignored.

## backend/.env

| Variable | Used by | Purpose | Where to get the value |
|---|---|---|---|
| `NODE_ENV` | `src/config/env.ts`, `src/middleware/error-handler.ts` | Switches error verbosity (stack traces hidden in production) and other environment-specific behavior. | Set manually: `development`, `test`, or `production`. |
| `PORT` | `src/server.ts` | Port the Express + Socket.io HTTP server listens on. | Pick any free local port; default `5000`. |
| `MONGODB_URI` | `src/config/db.ts` | Mongoose connection string for the MongoDB database. | Local dev: a local `mongod` instance (`mongodb://127.0.0.1:27017/saffron`). Staging/production: connection string from the MongoDB Atlas cluster's "Connect" dialog (or self-hosted MongoDB admin). |
| `CORS_ORIGIN` | `src/config/env.ts` (parsed into `env.corsOrigins`), used by `src/app.ts` and `src/sockets/index.ts` | Restricts which browser origin(s) may call the API / connect to Socket.io with credentials. **Comma-separated list** — each origin must exactly match a frontend URL (protocol + host + port), no trailing slash. The `cors` package is given the parsed array directly, which reflects back only the single origin that matches the request — never joins them into one header value (a comma-joined string in a single `Access-Control-Allow-Origin` header is invalid and gets rejected by the browser). | Local dev: `http://localhost:3000`. Staging/production: every deployed frontend URL that needs access, comma-separated, e.g. `http://localhost:3000,https://your-app.vercel.app` (keeping localhost is fine — it just adds an extra allowed origin, it doesn't affect production traffic). |
| `JWT_ACCESS_SECRET` | `src/utils/jwt.ts` | Signs/verifies the short-lived (15 min) access token issued on login and carried in the `Authorization: Bearer` header on every authenticated request. Also signs the short-lived interim 2FA token. | Generate locally: `openssl rand -hex 32`. Never reuse across environments; rotate immediately if leaked (invalidates all active sessions). |
| `JWT_REFRESH_SECRET` | `src/utils/jwt.ts` | Signs/verifies the long-lived (7 day) refresh token stored as an httpOnly cookie and hashed in the `sessions` collection for revocation. Must differ from `JWT_ACCESS_SECRET`. | Generate locally: `openssl rand -hex 32`. |
| `JWT_ACCESS_EXPIRY` | `src/config/env.ts`, `src/utils/jwt.ts` | Access token lifetime (jsonwebtoken duration string). | Set manually; PRD default is `15m`. |
| `JWT_REFRESH_EXPIRY` | `src/config/env.ts`, `src/utils/jwt.ts` | Refresh token lifetime (jsonwebtoken duration string) and the refresh cookie's `maxAge` basis. | Set manually; PRD default is `7d`. |
| `ENCRYPTION_KEY` | `src/utils/encryption.ts` (via `src/config/env.ts`) | AES-256-GCM key protecting Marketing module secrets-at-rest — the Meta WhatsApp Business Cloud API access token (`WhatsappConfig.accessTokenEncrypted`) now, a Gemini API key in Part 3. Must be exactly 64 hex characters (32 bytes); the process fails to start otherwise. | Generate locally: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never reuse across environments; rotating it makes every previously encrypted secret unreadable (the restaurant would need to reconnect WhatsApp). |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | `src/controllers/whatsapp-webhook.controller.ts` (via `src/config/env.ts`) | A value you choose, not one Meta issues — Meta echoes it back on the one-time `GET /api/public/whatsapp/webhook` verification handshake performed when you register the webhook URL, so this app can confirm the handshake is really from Meta before returning `hub.challenge`. | Generate any random string yourself, e.g. `openssl rand -hex 16`, then paste the **same** value into Meta App Dashboard → WhatsApp → Configuration → Webhook → "Verify token". |
| `META_APP_SECRET` | `src/middleware/verify-meta-signature.ts` (via `src/config/env.ts`) | Verifies the `X-Hub-Signature-256` HMAC-SHA256 header Meta signs every webhook POST with (`POST /api/public/whatsapp/webhook`) — the actual security boundary on that route, since it's public/unauthenticated by design. Requests with a missing or mismatched signature are rejected with 401 before the payload is ever processed. | Meta App Dashboard → App Settings → Basic → "App Secret" (the Meta App behind your WhatsApp Business Cloud API integration, not the WhatsApp Business Account itself). |

## frontend/.env.local (from `frontend/.env.example`)

| Variable | Used by | Purpose | Where to get the value |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `lib/api.ts` | Base URL the frontend's single API client calls for every backend request. `NEXT_PUBLIC_` prefix means it's exposed to the browser — never put secrets in a `NEXT_PUBLIC_` var. | Local dev: `http://localhost:5000` (the backend's dev server). Staging/production: the deployed backend's URL. |

## Adding a new variable

1. Add it to the relevant `.env.example` with a placeholder value (never a real secret).
2. Add a row to the table above: name, used by (file/module), purpose, where to obtain the value.
3. If it's a secret (API key, DB password, JWT signing key, etc.), confirm it is **not** prefixed `NEXT_PUBLIC_` on the frontend and is never logged or returned in API responses.
