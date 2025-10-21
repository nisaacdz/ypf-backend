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
    ALLOWED_ORIGINS: z
      .string()
      .transform((val) => val.split(",").map((s) => s.trim())),

    // Database
    DATABASE_URL: z.url("A valid DATABASE_URL is required"),

    // External Services (Grouped)
    AZURE_STORAGE_CONNECTION_STRING: z
      .string()
      .min(1, "AZURE_STORAGE_CONNECTION_STRING is required"),
    IMAGEKIT_URL_ENDPOINT: z.url("A valid IMAGEKIT_URL_ENDPOINT is required"),
    IMAGEKIT_PUBLIC_KEY: z.string().min(1, "IMAGEKIT_PUBLIC_KEY is required"),
    IMAGEKIT_PRIVATE_KEY: z.string().min(1, "IMAGEKIT_PRIVATE_KEY is required"),

    // SMTP Email Configuration
    SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
    SMTP_USER: z.string().min(1, "SMTP_USER is required"),
    SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
    EMAILER: z.email("A valid sender email (EMAILER) is required"),

    // Application Metadata
    LOGO_URL: z.url("A valid LOGO_URL is required"),
    YEAR: z.string().default(new Date().getFullYear().toString()),
    VERSION: z.string().default("1.0.0"),
  })
  .transform((env) => ({
    app: {
      environment: env.NODE_ENV,
      isProduction: env.NODE_ENV === "production",
      host: env.HOST,
      port: env.PORT,
      logoUrl: env.LOGO_URL,
      year: env.YEAR,
      version: env.VERSION,
    },
    security: {
      jwtSecret: env.JWT_SECRET,
      allowedOrigins: env.ALLOWED_ORIGINS,
    },
    database: {
      url: env.DATABASE_URL,
    },
    services: {
      azure: {
        connectionString: env.AZURE_STORAGE_CONNECTION_STRING,
      },
      imagekit: {
        urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
        publicKey: env.IMAGEKIT_PUBLIC_KEY,
        privateKey: env.IMAGEKIT_PRIVATE_KEY,
      },
      email: {
        host: env.SMTP_HOST,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        sender: env.EMAILER,
      },
    },
  }));

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(z.treeifyError(parsedEnv.error), null, 4),
  );
  process.exit(1);
}

const variables = parsedEnv.data;

export default variables;
