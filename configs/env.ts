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

    DASHBOARD_URL: z.string().optional(),
    WEBSITE_URL: z.string().optional(),
    ALLOWED_ORIGINS: z
      .string()
      .transform((val) => val.split(",").map((s) => s.trim())),

    // Database
    DATABASE_URL: z.url("A valid DATABASE_URL is required"),

    // External Services (Grouped)
    AZURE_STORAGE_CONNECTION_STRING: z
      .string()
      .min(1, "AZURE_STORAGE_CONNECTION_STRING is required"),
    REDIS_URL: z.string().min(1, "REDIS_URL is required").optional(),
    IMAGEKIT_URL_ENDPOINT: z.url("A valid IMAGEKIT_URL_ENDPOINT is required"),
    IMAGEKIT_PUBLIC_KEY: z.string().min(1, "IMAGEKIT_PUBLIC_KEY is required"),
    IMAGEKIT_PRIVATE_KEY: z.string().min(1, "IMAGEKIT_PRIVATE_KEY is required"),

    // Paystack Configuration. No default — the backend refuses to boot
    // without it so we fail fast at startup instead of silently 401-ing on
    // every payment call. Use a test key (sk_test_...) in non-prod envs.
    PAYSTACK_SECRET: z.string().min(1, "PAYSTACK_SECRET is required"),
    // Optional Paystack subaccount that should receive funds from any UMS-
    // initiated transaction (dues, donations, shop). Format: ACCT_xxxxxxxxxxx.
    // Leave blank to keep funds on the main account.
    PAYSTACK_SUBACCOUNT_CODE: z.string().optional(),

    // SMTP Email Configuration
    SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    // SSL on 465 vs STARTTLS on 587. Gmail uses 465/true; AWS SES + most
    // others use 587/false. Override via env when switching providers.
    SMTP_SECURE: z.coerce.boolean().default(true),
    SMTP_USER: z.string().min(1, "SMTP_USER is required"),
    SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
    EMAILER: z.email("A valid sender email (EMAILER) is required"),

    // Sentry error tracking. Optional — when SENTRY_DSN is unset, the
    // SDK init is a no-op so dev/staging/test environments don't have to
    // configure anything. In production, leave it set; missing DSN means
    // crashes vanish silently.
    SENTRY_DSN: z.url().optional(),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

    // Arkesel SMS Configuration. Optional — when ARKESEL_API_KEY is unset the
    // SMS client is a no-op and notifications fall back to email only. This
    // keeps non-prod environments and the test suite from needing real keys.
    ARKESEL_API_KEY: z.string().optional(),
    ARKESEL_SENDER_ID: z.string().max(11).default("YPF"),
    ARKESEL_BASE_URL: z.url().default("https://sms.arkesel.com/api/v2"),
    // When true, Arkesel accepts the request, returns "success", and does NOT
    // actually deliver the SMS. Default is OFF — explicit opt-in only — so
    // dev/staging actually exercises real delivery. Set ARKESEL_SANDBOX=true
    // to simulate without consuming credit.
    ARKESEL_SANDBOX: z.coerce.boolean().default(false),

    // Application Metadata
    LOGO_URL: z.url("A valid LOGO_URL is required"),
    YEAR: z.string().default(new Date().getFullYear().toString()),
    VERSION: z.string().default("0.1.0"),

    // Job Queue Configuration
    JOB_CONCURRENCY: z.coerce.number().positive().default(5),
    JOB_RETENTION_DAYS: z.coerce.number().positive().default(7),
    JOB_RETRY_LIMIT: z.coerce.number().nonnegative().default(3),
    JOB_RETRY_DELAY: z.coerce.number().positive().default(60),
    JOB_ARCHIVE_HOURS: z.coerce.number().positive().default(12),
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
      dashboardUrl: env.DASHBOARD_URL,
      websiteUrl: env.WEBSITE_URL,
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
        storageConnectionString: env.AZURE_STORAGE_CONNECTION_STRING,
      },
      redis: {
        url: env.REDIS_URL,
      },
      imagekit: {
        urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
        publicKey: env.IMAGEKIT_PUBLIC_KEY,
        privateKey: env.IMAGEKIT_PRIVATE_KEY,
      },
      email: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        sender: env.EMAILER,
      },
      paystack: {
        secretKey: env.PAYSTACK_SECRET,
        subaccountCode: env.PAYSTACK_SUBACCOUNT_CODE,
      },
      arkesel: {
        apiKey: env.ARKESEL_API_KEY,
        senderId: env.ARKESEL_SENDER_ID,
        baseUrl: env.ARKESEL_BASE_URL,
        sandbox: env.ARKESEL_SANDBOX,
      },
      sentry: {
        dsn: env.SENTRY_DSN,
        tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
      },
    },
    jobs: {
      concurrency: env.JOB_CONCURRENCY,
      retentionDays: env.JOB_RETENTION_DAYS,
      retryLimit: env.JOB_RETRY_LIMIT,
      retryDelay: env.JOB_RETRY_DELAY,
      archiveHours: env.JOB_ARCHIVE_HOURS,
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

// Audit I7 — production deployments MUST use a remote DB with password + SSL.
// A localhost / trust-auth URL slipping through to prod (e.g. via a copied
// .env) silently bypasses every auth control. Fail fast at startup.
if (variables.app.isProduction) {
  const url = process.env.DATABASE_URL ?? "";
  const looksLocal = /@(localhost|127\.0\.0\.1|::1)[:/]/.test(url);
  const hasPassword = /:\/\/[^:@/]+:[^@/]+@/.test(url);
  const hasSsl = /[?&]sslmode=(require|verify-(ca|full))\b/.test(url);

  if (looksLocal) {
    console.error(
      "❌ DATABASE_URL targets localhost in production. Use a managed Postgres host with password + sslmode=require.",
    );
    process.exit(1);
  }
  if (!hasPassword) {
    console.error(
      "❌ DATABASE_URL has no password in production. Use postgres://user:password@host:5432/db?sslmode=require.",
    );
    process.exit(1);
  }
  if (!hasSsl) {
    console.error(
      "❌ DATABASE_URL has no sslmode= in production. Append `?sslmode=require` (or stronger).",
    );
    process.exit(1);
  }
}

export default variables;
