import pgPool from "@/configs/db";
import logger from "@/configs/logger";

async function runMigrations() {
  logger.info("Starting migrations...");
  await pgPool.initialize();
  // runs migrations within initialize
}

runMigrations();
