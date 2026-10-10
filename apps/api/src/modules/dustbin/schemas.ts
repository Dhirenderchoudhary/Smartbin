import { z } from "zod";
import { BIN_INTERACTION_TYPES, BIN_ISSUE_TYPES } from "@smartbin/db";
import { ALLOWED_IMAGE_TYPES, type AllowedImageType } from "../../common/storage/s3.js";

const queryLat = z.coerce.number().min(-90).max(90);
const queryLng = z.coerce.number().min(-180).max(180);

export const uploadUrlQuery = z.object({
  contentType: z.enum(Object.keys(ALLOWED_IMAGE_TYPES) as [AllowedImageType, ...AllowedImageType[]], {
    errorMap: () => ({ message: "must be one of image/jpeg, image/png, image/webp" }),
  }),
});

export const nearbyQuery = z.object({
  lat: queryLat,
  lng: queryLng,
  radius: z.coerce.number().int().min(1).max(50000).optional(),
  // 1 = this is a "bins near me" search worth counting (not a map pan)
  log: z.enum(["0", "1"]).optional(),
});

export const interactionBody = z.object({
  type: z.enum(BIN_INTERACTION_TYPES),
});

export const createBody = z.object({
  name: z.string().trim().max(100).optional(),
  imageKey: z.string().min(1),
  type: z.enum(["WET", "DRY", "BOTH"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const reportMissingParams = z.object({
  id: z.string().uuid(),
});

export const reportMissingBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const reportIssueBody = z
  .object({
    type: z.enum(BIN_ISSUE_TYPES),
    note: z.string().trim().max(200).optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .refine((b) => b.type !== "OTHER" || b.note, { message: "Describe the problem", path: ["note"] });

export const resolveIssueBody = z.object({
  type: z.enum(BIN_ISSUE_TYPES),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type CreateBinInput = z.infer<typeof createBody>;
