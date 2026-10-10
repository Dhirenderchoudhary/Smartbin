import { z } from "zod";
import { BIN_EVENT_TYPES } from "@smartbin/db";
import { SETTING_DEFINITIONS, type SettingKey } from "../../common/settings.js";

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const timeseriesQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

export const binsListQuery = z.object({
  ...pagination,
  type: z.enum(["WET", "DRY", "BOTH"]).optional(),
  reported: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(["newest", "oldest", "mostReported"]).default("newest"),
});

export const binIdParams = z.object({
  id: z.string().uuid(),
});

export const binPatchBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    type: z.enum(["WET", "DRY", "BOTH"]).optional(),
    resetReports: z.literal(true).optional(),
  })
  .strict()
  .refine((b) => b.name !== undefined || b.type !== undefined || b.resetReports, {
    message: "Provide at least one of name, type or resetReports",
  });

export const eventsQuery = z.object({
  ...pagination,
  type: z.enum(BIN_EVENT_TYPES).optional(),
  binId: z.string().uuid().optional(),
});

export const usersQuery = z.object({
  ...pagination,
});

const settingValue = (key: SettingKey) => {
  const { min, max } = SETTING_DEFINITIONS[key];
  return z.number().int().min(min).max(max).optional();
};

// Partial update; ranges come from SETTING_DEFINITIONS so there is one source of truth
export const settingsBody = z
  .object({
    quotaLimitRegistrations: settingValue("quotaLimitRegistrations"),
    quotaLimitMissingReports: settingValue("quotaLimitMissingReports"),
    missingReportsThreshold: settingValue("missingReportsThreshold"),
  } satisfies Record<SettingKey, z.ZodTypeAny>)
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "Provide at least one setting to change",
  });

export type BinsListQuery = z.infer<typeof binsListQuery>;
export type SettingsBody = z.infer<typeof settingsBody>;
export type BinPatchBody = z.infer<typeof binPatchBody>;
export type EventsQuery = z.infer<typeof eventsQuery>;
