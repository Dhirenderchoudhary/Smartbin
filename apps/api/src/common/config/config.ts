import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  AWS_REGION: z.string().default("ap-south-1"),
  COGNITO_USER_POOL_ID: z.string().default("ap-south-1_dummy"),
  MOBILE_CLIENT_ID: z.string().default("dummy_mobile_client_id"),
  ADMIN_CLIENT_ID: z.string().default("dummy_admin_client_id"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/smartbin"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:3000"),
  
  // Bedrock Configuration
  BEDROCK_MODEL_ID: z.string().default("amazon.nova-lite-v1:0"),
  
  // S3 Configuration
  S3_BUCKET_NAME: z.string().default("smartbin-uploads"),
  
  // Quota Limits (Configurable without Admin UI)
  QUOTA_LIMIT_REGISTRATIONS: z.coerce.number().int().default(10),
  QUOTA_LIMIT_VERIFICATIONS: z.coerce.number().int().default(30),
  QUOTA_LIMIT_MISSING_REPORTS: z.coerce.number().int().default(15),
});

export const config = envSchema.parse(process.env);
