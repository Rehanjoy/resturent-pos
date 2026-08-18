import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./config/env";
import routes from "./routes";
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
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Parses the httpOnly refresh-token cookie set by the auth module.
  app.use(cookieParser());

  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
