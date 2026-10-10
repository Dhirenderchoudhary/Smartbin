import { binEvents, type Transaction } from "@smartbin/db";

export type NewBinEvent = typeof binEvents.$inferInsert;

// Call inside the same transaction as the change it records
export async function logBinEvent(tx: Transaction, event: NewBinEvent): Promise<void> {
  await tx.insert(binEvents).values(event);
}
