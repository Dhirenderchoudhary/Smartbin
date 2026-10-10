import { z } from "zod";
import { BIN_EVENT_TYPES } from "@smartbin/db";

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

export type BinsListQuery = z.infer<typeof binsListQuery>;
export type BinPatchBody = z.infer<typeof binPatchBody>;
export type EventsQuery = z.infer<typeof eventsQuery>;
