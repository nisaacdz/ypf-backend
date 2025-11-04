import type { Config } from "drizzle-kit";

export default {
  schema: "db/schema/entities.ts",
  out: "db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
  verbose: true,
  strict: true,
} satisfies Config;
