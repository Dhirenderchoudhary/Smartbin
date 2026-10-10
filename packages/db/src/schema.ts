import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid, doublePrecision } from "drizzle-orm/pg-core";

export const bins = pgTable("bins", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  imageKey: text("image_key").notNull(),
  type: text("type", { enum: ["WET", "DRY", "BOTH"] }).notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  status: text("status", { enum: ["ACTIVE", "MISSING"] }).notNull().default("ACTIVE"),
  missingReports: integer("missing_reports").notNull().default(0),
  fillPercent: integer("fill_percent").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  cognitoSub: text("cognito_sub").notNull().unique(),
  email: text("email"),
  role: text("role").notNull().default("USER"),
  points: integer("points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userMonthlyUsage = pgTable(
  "user_monthly_usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // "YYYY-MM"
    registrations: integer("registrations").notNull().default(0),
    missingReports: integer("missing_reports").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month] })]
);

export const BIN_EVENT_TYPES = [
  "REGISTERED",
  "MISSING_REPORT",
  "REMOVED",
  "ADMIN_EDIT",
  "ADMIN_DELETE",
  "ADMIN_RESET_REPORTS",
] as const;

export type BinEventType = (typeof BIN_EVENT_TYPES)[number];

// History of everything that happens to a bin. bin_id has no FK on purpose:
// events must survive when a bin is removed after K missing reports.
export const binEvents = pgTable(
  "bin_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    binId: uuid("bin_id").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type", { enum: BIN_EVENT_TYPES }).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bin_events_bin_id_idx").on(t.binId),
    index("bin_events_type_created_at_idx").on(t.type, t.createdAt),
    index("bin_events_user_id_idx").on(t.userId),
  ]
);
