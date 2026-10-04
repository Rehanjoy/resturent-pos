import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./config/env";
import routes from "./routes";
import publicRoutes from "./routes/public.routes";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

export function createApp(): Express {
  const app = express();

  // Security headers (PRD §7 "HSTS enforced" + general OWASP hardening).
  // `crossOriginResourcePolicy` is relaxed to same-site rather than
  // same-origin: the frontend and backend run on different origins
  // (separate Next.js/Express apps per the client's explicit split), and
  // the invoice PDF / CSV export responses need to be fetchable from the
  // frontend origin.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );

  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      maxAge: 600,
    }),
  );
  app.use(
    express.json({
      // Captures the exact raw request bytes on every request (cheap —
      // `express.json` already buffers the body internally to parse it),
      // stashed as `req.rawBody`. The one consumer today is
      // `middleware/verify-meta-signature.ts`: Meta signs its WhatsApp
      // webhook POSTs (`whatsapp-webhook.routes.ts`) with HMAC-SHA256 over
      // these exact bytes, and re-signing the already-parsed-and-
      // re-stringified `req.body` would not reliably reproduce the same
      // signature (key order / whitespace can differ). Every other route
      // ignores `req.rawBody` entirely.
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));
  // Parses the httpOnly refresh-token cookie set by the auth module.
  app.use(cookieParser());

  // Mounted before the authenticated `/api` router tree and as its own
  // prefix (not a route inside `routes/index.ts`) so it's structurally
  // impossible for this router to end up behind the `authenticate`
  // middleware some other route file adds — every route on `publicRoutes`
  // is intentionally unauthenticated (the public restaurant website, PRD
  // §3.13). See `routes/public.routes.ts` for the rate limiter applied to
  // it.
  app.use("/api/public", publicRoutes);
  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
