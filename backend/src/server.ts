import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/db";
import { initSocketServer } from "./sockets";

async function start(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);

  initSocketServer(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`[server] Saffron API listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((error) => {
  console.error("[server] Failed to start", error);
  process.exit(1);
});
