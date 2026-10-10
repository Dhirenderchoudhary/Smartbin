import express, { Router } from "express";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config/config.js";
import { ApiError } from "../http/ApiError.js";

// STORAGE_MODE=local: photos go to a folder on disk instead of S3, with the same
// upload-link flow (PUT the bytes to uploadUrl). Local only, refused in production.
// ponytail: upload links are not signed or expiring; fine on a dev machine, never deploy this.

const ROOT = path.resolve(".local-uploads");
const KEY_PATTERN = /^dustbins\/[0-9a-f-]+\/[0-9a-f-]+\.(jpg|png|webp)$/;
const TYPE_BY_EXT = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

function filePath(key: string): string {
  if (!KEY_PATTERN.test(key)) {
    throw ApiError.badRequest("Invalid image key.", "INVALID_IMAGE_KEY");
  }
  return path.join(ROOT, key);
}

function contentTypeOf(key: string): string {
  return TYPE_BY_EXT[key.split(".").pop() as keyof typeof TYPE_BY_EXT];
}

export function localImageUrl(key: string): string {
  return `${config.API_PUBLIC_URL}/v1/local-uploads/${key}`;
}

export async function readLocalImage(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  try {
    return { bytes: await readFile(filePath(key)), contentType: contentTypeOf(key) };
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw ApiError.notFound("No uploaded image found for this key. Upload the photo first.", "INVALID_IMAGE_KEY");
    }
    throw err;
  }
}

export async function deleteLocalImage(key: string): Promise<void> {
  await rm(filePath(key), { force: true });
}

export const localUploadsRouter = Router();

localUploadsRouter.put(
  /^\/(dustbins\/.+)$/,
  express.raw({ type: Object.values(TYPE_BY_EXT), limit: "5mb" }),
  async (req, res, next) => {
    try {
      const key = req.params[0]!;
      const target = filePath(key); // validates the key first
      if (req.headers["content-type"] !== contentTypeOf(key) || !Buffer.isBuffer(req.body)) {
        throw ApiError.badRequest("Content-Type must match the type the upload link was made for.", "UNSUPPORTED_MEDIA");
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, req.body);
      res.status(200).end();
    } catch (err) {
      next(err);
    }
  }
);

localUploadsRouter.get(/^\/(dustbins\/.+)$/, (req, res, next) => {
  try {
    const key = req.params[0]!;
    const file = filePath(key); // validates the key first
    res.type(contentTypeOf(key)).sendFile(file, (err) => err && res.status(404).end());
  } catch (err) {
    next(err);
  }
});
