import { getDb, users, eq } from "@smartbin/db";
import { config } from "../../common/config/config.js";
import { currentMonth, getUsage } from "./quota.js";

export interface DBUserRecord {
  id: string;
  cognitoSub: string;
  email: string | null;
  role: string;
  points: number;
  createdAt: Date;
}

export async function syncUserByCognitoSub(
  cognitoSub: string,
  email?: string,
  role: "USER" | "ADMIN" = "USER",
  resolveEmail?: () => Promise<string | undefined>
): Promise<DBUserRecord> {
  const db = getDb();
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.cognitoSub, cognitoSub));

  if (existingUsers.length > 0 && existingUsers[0]) {
    const existing = existingUsers[0];
    // Backfill users created before emails were looked up
    if (!existing.email && resolveEmail) {
      const found = await resolveEmail();
      if (found) {
        const [updated] = await db.update(users).set({ email: found }).where(eq(users.id, existing.id)).returning();
        return updated ?? existing;
      }
    }
    return existing;
  }

  email ??= await resolveEmail?.();

  // A user's first requests can arrive in parallel; ignore the conflict and re-read
  const [newUser] = await db
    .insert(users)
    .values({
      cognitoSub,
      email: email ?? null,
      role,
    })
    .onConflictDoNothing({ target: users.cognitoSub })
    .returning();

  if (newUser) {
    return newUser;
  }

  const [concurrentUser] = await db
    .select()
    .from(users)
    .where(eq(users.cognitoSub, cognitoSub));

  if (concurrentUser) {
    return concurrentUser;
  }

  throw new Error("Failed to insert user record.");
}

export async function getUserQuota(userId: string) {
  const used = await getUsage(userId);

  const limits = {
    registrations: config.QUOTA_LIMIT_REGISTRATIONS,
    missingReports: config.QUOTA_LIMIT_MISSING_REPORTS,
  };

  return {
    month: currentMonth(),
    limits,
    used,
    remaining: {
      registrations: Math.max(0, limits.registrations - used.registrations),
      missingReports: Math.max(0, limits.missingReports - used.missingReports),
    },
  };
}
