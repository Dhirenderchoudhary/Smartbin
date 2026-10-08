import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const bins = pgTable("bins", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  fillPercent: integer("fill_percent").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
