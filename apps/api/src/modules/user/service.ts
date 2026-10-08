import { getDb, users, eq } from "@smartbin/db";
import { config } from "../../common/config/config.js";

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
  role: "USER" | "ADMIN" = "USER"
): Promise<DBUserRecord> {
  const db = getDb();
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.cognitoSub, cognitoSub));

  if (existingUsers.length > 0 && existingUsers[0]) {
    return existingUsers[0];
  }

  const [newUser] = await db
    .insert(users)
    .values({
      cognitoSub,
      email: email ?? null,
      role,
    })
    .returning();

  if (newUser) {
    return newUser;
  }

  throw new Error("Failed to insert user record.");
}

export async function getUserQuota(_userId: string) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // Later: Fetch actual used quota from db. For now, defaulting to 0.
  const used = {
    registrations: 0,
    verifications: 0,
    missingReports: 0,
  };

  const limits = {
    registrations: config.QUOTA_LIMIT_REGISTRATIONS,
    verifications: config.QUOTA_LIMIT_VERIFICATIONS,
    missingReports: config.QUOTA_LIMIT_MISSING_REPORTS,
  };

  return {
    month: currentMonth,
    limits,
    used,
    remaining: {
      registrations: limits.registrations - used.registrations,
      verifications: limits.verifications - used.verifications,
      missingReports: limits.missingReports - used.missingReports,
    },
  };
}
