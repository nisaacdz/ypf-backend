import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  environment: z.enum(["development", "production", "test"]),
  host: z.string().default("localhost"),
  port: z.coerce.number().default(3000),
  jwtSecret: z.uuid(),
  smtpPort: z.number(),
  smtpHost: z.string(),
  databaseUrl: z.string(),
  serviceName: z.string(),
  serviceEmail: z.email(),
  serviceEmailer: z.email(),
  serviceEmailerPass: z.string(),
  serviceLogo: z.string(),
  allowedOrigins: z.string(),
  apiKey: z.string(),
  year: z.string(),
  version: z.string(),
  geminiApiKey: z.string().min(1, { message: "Gemini API Key is required" }),
});

const variables = {
  environment: process.env.NODE_ENV || "development",
  host: process.env.HOST,
  port: process.env.PORT,
  jwtSecret: process.env.JWT_SECRET,
  sessionSecret: process.env.SESSION_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  serviceName: process.env.SERVICE_NAME,
  serviceEmail: process.env.SERVICE_EMAIL,
  serviceEmailer: process.env.SERVICE_EMAILER,
  serviceEmailerPass: process.env.SERVICE_EMAILER_PASS,
  serviceLogo: process.env.SERVICE_LOGO,
  clientUrl: process.env.CLIENT_URL,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  apiKey: process.env.API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
};

const parsedEnv = envSchema.safeParse(variables);

if (!parsedEnv.success) {
  console.error("Invalid environment variables:", parsedEnv.error.format());
  throw parsedEnv.error;
}

const { allowedOrigins, ...others } = parsedEnv.data;

const envConfig = { ...others, allowedOrigins: allowedOrigins.split(",") };

export default envConfig;
