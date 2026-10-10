import { Request, Response, NextFunction, RequestHandler } from "express";
import { getDb, userMonthlyUsage, eq, and, sql, type Transaction } from "@smartbin/db";
import { ApiError } from "../../common/http/ApiError.js";
import { getSettings } from "../../common/settings.js";
import { APP_TIMEZONE, currentMonth, nextMonthStart } from "../../common/time.js";

export type QuotaField = "registrations" | "missingReports";

// Limits are set by admins (app_settings), falling back to .env defaults
export async function quotaLimit(field: QuotaField): Promise<number> {
  const settings = await getSettings();
  return field === "registrations" ? settings.quotaLimitRegistrations : settings.quotaLimitMissingReports;
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

// Runs before anything else on the route, so an exhausted user gets the quota error straight away
export function requireQuota(field: QuotaField): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const [usage, limit] = await Promise.all([getUsage(req.user!.id), quotaLimit(field)]);
      if (usage[field] >= limit) {
        return next(quotaExceeded(field, limit));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Atomically uses one unit of quota. A new month starts a new row, so no reset job is needed.
// requireQuota is the fast check; this is the guarantee when requests race.
export async function consumeQuota(tx: Transaction, userId: string, field: QuotaField): Promise<void> {
  const limit = await quotaLimit(field);
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
    throw quotaExceeded(field, limit);
  }
}

export function quotaExceeded(field: QuotaField, limit: number): ApiError {
  const action = field === "registrations" ? "bin registrations" : "missing reports";
  const resetsOn = new Date(`${nextMonthStart()}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    timeZone: APP_TIMEZONE,
  });
  return new ApiError(
    429,
    "QUOTA_EXCEEDED",
    `Your limit for ${action} is exhausted. You have used all ${limit} for this month. It resets on ${resetsOn}.`,
    { field, limit, resetsOn: nextMonthStart() }
  );
}
