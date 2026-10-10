import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { users } from "./schema.js";

type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { db?: Database };

export function getDb() {
  if (globalForDb.db) return globalForDb.db;

  const url = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:15432/smartbin";

  const db = drizzle(postgres(url, { max: 10 }), { schema });
  globalForDb.db = db;
  return db;
}

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export {
  bins,
  users,
  userMonthlyUsage,
  binEvents,
  binIssues,
  binInteractions,
  searchLogs,
  BIN_INTERACTION_TYPES,
  type BinInteractionType,
  BIN_ISSUE_TYPES,
  type BinIssueType,
  appSettings,
  settingChanges,
  BIN_EVENT_TYPES,
  type BinEventType,
} from "./schema.js";
export { eq, sql, and, desc, asc, gt, ilike, count, getTableColumns, isNull, inArray, gte, lte, or } from "drizzle-orm";
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
