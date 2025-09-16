import type { Config } from "drizzle-kit";
import envConfig from "./configs/env";

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: envConfig.databaseUrl,
  },
  verbose: true,
  strict: true,
} satisfies Config;
