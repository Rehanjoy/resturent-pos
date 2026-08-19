import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  corsOrigins: string[];
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiry: string;
  jwtRefreshExpiry: string;
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env: EnvConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  mongodbUri: requireEnv("MONGODB_URI", "mongodb://127.0.0.1:27017/saffron"),
  corsOrigins: requireEnv("CORS_ORIGIN", "http://localhost:3000")
    .split(",")
    .map((o) => o.trim()),
  // JWT signing secrets are real secrets — no fallback value. The process
  // must fail to start rather than sign tokens with a guessable default.
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: requireEnv("JWT_REFRESH_SECRET"),
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY ?? "15m",
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "7d",
};
