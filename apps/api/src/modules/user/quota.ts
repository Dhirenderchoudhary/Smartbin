import { getDb, userMonthlyUsage, eq, and, sql, type Transaction } from "@smartbin/db";
import { ApiError } from "../../common/http/ApiError.js";

export type QuotaField = "registrations" | "missingReports";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function getUsage(userId: string): Promise<Record<QuotaField, number>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userMonthlyUsage)
    .where(and(eq(userMonthlyUsage.userId, userId), eq(userMonthlyUsage.month, currentMonth())))
    .limit(1);

  return {
    registrations: row?.registrations ?? 0,
    missingReports: row?.missingReports ?? 0,
  };
}

// Atomically uses one unit of quota. A new month starts a new row, so no reset job is needed.
export async function consumeQuota(
  tx: Transaction,
  userId: string,
  field: QuotaField,
  limit: number
): Promise<void> {
  const column = userMonthlyUsage[field];

  const rows = await tx
    .insert(userMonthlyUsage)
    .values({ userId, month: currentMonth(), [field]: 1 })
    .onConflictDoUpdate({
      target: [userMonthlyUsage.userId, userMonthlyUsage.month],
      set: { [field]: sql`${column} + 1` },
      setWhere: sql`${column} < ${limit}`,
    })
    .returning();

  // Covers the case where the limit is 0 and the row was freshly inserted at 1
  if (rows.length === 0 || rows[0]![field] > limit) {
    throw quotaExceeded(field);
  }
}

export function quotaExceeded(field: QuotaField): ApiError {
  const action = field === "registrations" ? "bin registrations" : "missing reports";
  return ApiError.tooManyRequests(
    `You have used all your ${action} for this month. Try again next month.`,
    "QUOTA_EXCEEDED"
  );
}
