import type { Config } from "drizzle-kit";
import variables from "@/configs/env";

export default {
  schema: "db/schema/entities.ts",
  out: "db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: variables.database.url,
  },
  verbose: true,
  strict: true,
} satisfies Config;
