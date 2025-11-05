import { beforeAll, afterAll } from "vitest";
import pgPool from "@/configs/db";
import emailer from "@/configs/emailer";
import logger from "@/configs/logger";
import variables from "@/configs/env";

variables.app.environment = "test";

beforeAll(async () => {
  await pgPool.initialize();
  await Promise.all([emailer.initialize()]);
});

afterAll(() => {
  pgPool.reset();
  logger.info("Database pool reset.");
});
