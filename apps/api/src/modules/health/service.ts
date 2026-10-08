import { getDb, sql } from "@smartbin/db";

export async function checkHealth() {
  let dbStatus = false;
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1;`);
    dbStatus = true;
  } catch (err) {
    dbStatus = false;
  }

  return {
    ok: true,
    db: dbStatus,
    timestamp: new Date().toISOString(),
  };
}

