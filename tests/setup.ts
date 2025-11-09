import { beforeAll, afterAll } from "vitest";
import dbClient from "@/configs/db";
import emailer from "@/configs/emailer";
import logger from "@/configs/logger";
import variables from "@/configs/env";

variables.app.environment = "test";

beforeAll(async () => {
  await dbClient.initialize();
  await Promise.all([emailer.initialize()]);
});

afterAll(() => {
  logger.info("Database pool reset.");
});
