import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid, doublePrecision } from "drizzle-orm/pg-core";

export const bins = pgTable("bins", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  imageKey: text("image_key").notNull(),
  type: text("type", { enum: ["WET", "DRY", "BOTH"] }).notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  status: text("status", { enum: ["ACTIVE", "MISSING"] }).notNull().default("ACTIVE"),
  missingReports: integer("missing_reports").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  // Demo bins are created on demand around people who open the map where no bins exist (DEMO_MODE)
  isDemo: boolean("is_demo").notNull().default(false),
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

// Admin-editable settings (quota limits, removal threshold). Missing keys fall back to .env defaults.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Who changed which setting, from what, to what
export const settingChanges = pgTable(
  "setting_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("setting_changes_changed_at_idx").on(t.changedAt)]
);

export const BIN_EVENT_TYPES = [
  "REGISTERED",
  "MISSING_REPORT",
  "REMOVED",
  "ADMIN_EDIT",
  "ADMIN_DELETE",
  "ADMIN_RESET_REPORTS",
  "ISSUE_REPORT",
  "ISSUE_RESOLVED",
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

export const BIN_ISSUE_TYPES = ["FULL", "BROKEN", "DIRTY", "OTHER"] as const;
export type BinIssueType = (typeof BIN_ISSUE_TYPES)[number];

// Problems people report with a bin that's still there (missing bins use missing_reports).
// A report is open until someone at the bin, or an admin, marks it resolved; FULL also expires on its own.
export const binIssues = pgTable(
  "bin_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    binId: uuid("bin_id")
      .notNull()
      .references(() => bins.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type", { enum: BIN_ISSUE_TYPES }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("bin_issues_bin_id_idx").on(t.binId)]
);

export const BIN_INTERACTION_TYPES = ["VIEW", "DIRECTIONS", "ARRIVED"] as const;
export type BinInteractionType = (typeof BIN_INTERACTION_TYPES)[number];

// How much people want each bin: opened it, asked for directions, walked there.
// Separate from bin_events (the admin audit trail), which these would drown out.
export const binInteractions = pgTable(
  "bin_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    binId: uuid("bin_id")
      .notNull()
      .references(() => bins.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type", { enum: BIN_INTERACTION_TYPES }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bin_interactions_bin_id_created_at_idx").on(t.binId, t.createdAt),
    index("bin_interactions_type_created_at_idx").on(t.type, t.createdAt),
  ]
);

// Runs of the AI photo-check evaluation (labelled test photos), shown on the public /evals page.
// summary: headline numbers; results: one entry per photo with the model's verdict and reason.
export const evalRuns = pgTable(
  "eval_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // "vision"
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    triggeredBy: uuid("triggered_by").references(() => users.id, { onDelete: "set null" }),
    durationMs: integer("duration_ms").notNull(),
    summary: jsonb("summary").notNull(),
    results: jsonb("results").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("eval_runs_kind_created_at_idx").on(t.kind, t.createdAt)]
);

// "Try your own photo" checks on /evals: for the daily limit per user and the page's counter.
// The photo itself is deleted right after the check; only the verdict is kept.
export const photoChecks = pgTable(
  "photo_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    accepted: boolean("accepted").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("photo_checks_user_id_created_at_idx").on(t.userId, t.createdAt)]
);

// Where people look for bins. Anonymous on purpose: no user, position rounded to ~100 m.
// binsNearby = 0 marks a spot where people want a bin and there isn't one.
export const searchLogs = pgTable(
  "search_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    latCell: doublePrecision("lat_cell").notNull(),
    lngCell: doublePrecision("lng_cell").notNull(),
    binsNearby: integer("bins_nearby").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("search_logs_created_at_idx").on(t.createdAt)]
);
