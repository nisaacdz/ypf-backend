import variables from "@/configs/env";
import emailer from "@/configs/emailer";
import dbClient from "./configs/db";
import logger from "@/configs/logger";
import server from "@/configs/server";
import redisClient from "./configs/redis";

async function shutdown() {
  logger.info("Shutting down server...");

  try {
    emailer.transporter.close();
    await dbClient.pool.end({ timeout: 5 });
    logger.info("Database pool closed.");
  } catch (error) {
    logger.error(error, "Error closing database pool");
  }

  server.close(() => {
    logger.info("Server closed.");
    process.exit(0);
  });
}

(async () => {
  try {
    await Promise.all([
      emailer.initialize(),
      dbClient.initialize(),
      redisClient.initialize(),
    ]);

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.on(signal, shutdown);
    }

    server.listen(variables.app.port, () => {
      logger.info(
        `Server is live on http://${variables.app.host}:${variables.app.port}`,
      );
    });
  } catch (error) {
    logger.error(error, "Failed to initialize server");
    process.exit(1); // Fail fast
  }
})();
