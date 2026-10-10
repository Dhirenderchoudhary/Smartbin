import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  AWS_REGION: z.string().default("ap-south-1"),
  COGNITO_USER_POOL_ID: z.string().min(1),
  MOBILE_CLIENT_ID: z.string().min(1),
  ADMIN_CLIENT_ID: z.string().default("dummy_admin_client_id"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:15432/smartbin"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:3000"),

  // Image verification: "openai" now; switch to "bedrock" once the account is unblocked
  VISION_PROVIDER: z.enum(["openai", "bedrock"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),

  // Bedrock Configuration
  BEDROCK_MODEL_ID: z.string().default("amazon.nova-lite-v1:0"),

  // S3 Configuration
  S3_BUCKET_NAME: z.string().default("smartbin-uploads"),

  // Quota Limits (Configurable without Admin UI)
  QUOTA_LIMIT_REGISTRATIONS: z.coerce.number().int().default(10),
  QUOTA_LIMIT_MISSING_REPORTS: z.coerce.number().int().default(15),

  // A bin is removed from the DB once it reaches this many missing reports
  MISSING_REPORTS_THRESHOLD: z.coerce.number().int().min(1).default(3),
});

export const config = envSchema.parse(process.env);
