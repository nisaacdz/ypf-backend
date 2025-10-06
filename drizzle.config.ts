import type { Config } from "drizzle-kit";
import variables from "@/configs/env";

export default {
  schema: "db/schema/entities.ts",
  out: "db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: variables.databaseUrl,
  },
  verbose: true,
  strict: true,
} satisfies Config;
