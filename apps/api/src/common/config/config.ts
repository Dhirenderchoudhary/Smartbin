import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  AWS_REGION: z.string().default("ap-south-1"),
  // "dev" skips Cognito: the token is just the user's email. Local only, refused in production.
  AUTH_MODE: z.enum(["cognito", "dev"]).default("cognito"),
  DEV_ADMIN_EMAILS: z.string().default(""),
  COGNITO_USER_POOL_ID: z.string().min(1),
  MOBILE_CLIENT_ID: z.string().min(1),
  ADMIN_CLIENT_ID: z.string().default("dummy_admin_client_id"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:15432/smartbin"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:3001"),

  // Image verification: "openai" now; switch to "bedrock" once the account is unblocked.
  // "off" accepts every photo, for local runs without an AI key (refused in production)
  VISION_PROVIDER: z.enum(["openai", "bedrock", "off"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),

  // Bedrock Configuration
  BEDROCK_MODEL_ID: z.string().default("amazon.nova-lite-v1:0"),

  // S3 Configuration. "local" stores photos in apps/api/.local-uploads instead (local only)
  STORAGE_MODE: z.enum(["s3", "local"]).default("s3"),
  // Base URL clients use to reach this API; used for local photo links (a phone needs the LAN IP)
  API_PUBLIC_URL: z.string().optional(),
  S3_BUCKET_NAME: z.string().default("smartbin-uploads"),

  // Quota Limits (Configurable without Admin UI)
  QUOTA_LIMIT_REGISTRATIONS: z.coerce.number().int().default(10),
  QUOTA_LIMIT_MISSING_REPORTS: z.coerce.number().int().default(15),

  // A bin is removed from the DB once it reaches this many missing reports
  MISSING_REPORTS_THRESHOLD: z.coerce.number().int().min(1).default(3),
});

const parsed = envSchema.parse(process.env);
export const config = { ...parsed, API_PUBLIC_URL: parsed.API_PUBLIC_URL ?? `http://localhost:${parsed.PORT}` };

if (
  config.NODE_ENV === "production" &&
  (config.AUTH_MODE === "dev" || config.STORAGE_MODE === "local" || config.VISION_PROVIDER === "off")
) {
  throw new Error("AUTH_MODE=dev, STORAGE_MODE=local and VISION_PROVIDER=off are local-only and not allowed in production");
}
