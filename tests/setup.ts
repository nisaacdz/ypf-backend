import { beforeAll, afterAll } from "vitest";
import pgPool from "@/configs/db";
import emailer from "@/configs/emailer";
import logger from "@/configs/logger";

beforeAll(async () => {
  await pgPool.initialize();
  await Promise.all([emailer.initialize()]);
});

afterAll(() => {
  pgPool.reset();
  logger.info("Database pool reset.");
});
