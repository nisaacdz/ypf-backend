import variables from "@/configs/env";
import emailer from "@/configs/emailer";
import dbClient from "./configs/db";
import logger from "@/configs/logger";
import server from "@/configs/server";
import redisClient from "./configs/redis";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { startWorkers } from "@/configs/jobs/workers";

async function shutdown() {
  logger.info("Shutting down server...");

  try {
    // Shut down job dispatcher first
    await jobDispatcher.shutdown();
    logger.info("Job dispatcher stopped.");

    emailer.transporter.close();
    await dbClient.pool.end({ timeout: 5 });
    logger.info("Database pool closed.");
  } catch (error) {
    logger.error(error, "Error during shutdown");
  }

  server.close(() => {
    logger.info("Server closed.");
    process.exit(0);
  });

  // Force exit after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
}

(async () => {
  try {
    // Initialize all services
    await Promise.all([
      emailer.initialize(),
      dbClient.initialize(),
      redisClient.initialize(),
      jobDispatcher.initialize(),
    ]);

    // Start job workers AFTER all services are initialized
    await startWorkers();

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
