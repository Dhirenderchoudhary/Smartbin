import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { users } from "./schema.js";

type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { db?: Database };

export function getDb() {
  if (globalForDb.db) return globalForDb.db;

  const url = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/smartbin";

  const db = drizzle(postgres(url, { max: 10 }), { schema });
  globalForDb.db = db;
  return db;
}

export { bins, users } from "./schema.js";
export { eq, sql, and } from "drizzle-orm";
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;



