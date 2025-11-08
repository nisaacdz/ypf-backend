import dbClient from "@/configs/db";
import logger from "@/configs/logger";

async function runMigrations() {
  logger.info("Starting migrations...");
  await dbClient.initialize();
  // runs migrations within initialize
}

runMigrations();
