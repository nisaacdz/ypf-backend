import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z
  .object({
    // Application Environment
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    HOST: z.string().default("localhost"),
    PORT: z.coerce.number().positive().default(3000),

    // Security and Authentication
    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET must be at least 32 characters long"),

    // Database
    DATABASE_URL: z.url("A valid DATABASE_URL is required"),

    // SMTP Email Configuration
    SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
    SMTP_USER: z.string().min(1, "SMTP_USER is required"),
    SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
    EMAILER: z.email("A valid sender email (EMAILER) is required"),

    // External Services & CORS
    // GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
    ALLOWED_ORIGINS: z
      .string()
      .min(1, "ALLOWED_ORIGINS is required")
      .transform((val) => val.split(",").map((s) => s.trim())),

    // Oauth
    // GOOGLE_AUTH_CLIENT_ID: z
    //   .string()
    //   .min(1, "GOOGLE_AUTH_CLIENT_ID is required"),
    // GOOGLE_AUTH_CLIENT_SECRET: z
    //   .string()
    //   .min(1, "GOOGLE_AUTH_CLIENT_SECRET is required"),

    // Application Metadata
    LOGO_URL: z.url("A valid LOGO_URL is required"),
    YEAR: z.string().default(new Date().getFullYear().toString()),
    VERSION: z.string().default("1.0.0"),
  })
  .transform((env) => ({
    environment: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    jwtSecret: env.JWT_SECRET,
    databaseUrl: env.DATABASE_URL,
    smtpHost: env.SMTP_HOST,
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    emailer: env.EMAILER,
    // geminiApiKey: env.GEMINI_API_KEY,
    allowedOrigins: env.ALLOWED_ORIGINS,
    // googleAuthClientId: env.GOOGLE_AUTH_CLIENT_ID,
    // googleAuthClientSecret: env.GOOGLE_AUTH_CLIENT_SECRET,
    logoUrl: env.LOGO_URL,
    year: env.YEAR,
    version: env.VERSION,
  }));

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(z.treeifyError(parsedEnv.error), null, 4),
  );

  process.exit(1);
}

const envData = parsedEnv.data;

const variables = {
  ...envData,
  isProduction: envData.environment === "production",
};

export default variables;
