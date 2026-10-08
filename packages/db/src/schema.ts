import { integer, pgTable, text, timestamp, uuid, doublePrecision } from "drizzle-orm/pg-core";

export const bins = pgTable("bins", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  imageUrl: text("image_url").notNull(),
  type: text("type", { enum: ["WET", "DRY", "BOTH"] }).notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  status: text("status", { enum: ["ACTIVE", "MISSING"] }).notNull().default("ACTIVE"),
  missingReports: integer("missing_reports").notNull().default(0),
  fillPercent: integer("fill_percent").notNull().default(0),
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

