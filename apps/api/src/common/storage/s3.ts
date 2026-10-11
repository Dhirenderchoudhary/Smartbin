import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config/config.js";
import { ApiError } from "../http/ApiError.js";
import { v4 as uuidv4 } from "uuid";
import { deleteLocalImage, localImageUrl, readLocalImage } from "./local.js";

const LOCAL = config.STORAGE_MODE === "local";

const s3Client = new S3Client({ region: config.AWS_REGION });

export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Every user uploads under their own prefix so a key can be checked against its owner
export function userImagePrefix(userId: string): string {
  return `dustbins/${userId}/`;
}

export async function generateUploadUrl(
  userId: string,
  contentType: AllowedImageType
): Promise<{ uploadUrl: string; key: string }> {
  const key = `${userImagePrefix(userId)}${uuidv4()}.${ALLOWED_IMAGE_TYPES[contentType]}`;

  const command = new PutObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  if (LOCAL) {
    return { uploadUrl: localImageUrl(key), key };
  }

  // Presigned URL valid for 5 minutes
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  return { uploadUrl, key };
}

// What the file really is, from its first bytes (the uploader chooses the Content-Type, so it can lie)
export function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function getImageObject(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const image = LOCAL ? await readLocalImage(key) : await readS3Image(key);
  const actual = detectImageType(image.bytes);
  if (!actual || actual !== image.contentType) {
    throw ApiError.badRequest("That file isn't a real JPEG, PNG or WebP photo.", "UNSUPPORTED_MEDIA");
  }
  return image;
}

async function readS3Image(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  let response;
  try {
    response = await s3Client.send(new GetObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: key }));
  } catch (err: any) {
    // Only a missing object is the client's fault; NoSuchBucket etc. are server misconfiguration
    if (err?.name === "NoSuchKey") {
      throw ApiError.notFound("No uploaded image found for this key. Upload the photo first.", "INVALID_IMAGE_KEY");
    }
    throw err;
  }

  const contentType = response.ContentType ?? "";
  if (!(contentType in ALLOWED_IMAGE_TYPES)) {
    throw ApiError.badRequest("Uploaded file must be a JPEG, PNG or WebP image.", "UNSUPPORTED_MEDIA");
  }
  if ((response.ContentLength ?? 0) > MAX_IMAGE_BYTES) {
    throw ApiError.badRequest("Image is too large. The limit is 5 MB.", "UNSUPPORTED_MEDIA");
  }
  if (!response.Body) {
    throw ApiError.notFound("Uploaded image is empty.", "INVALID_IMAGE_KEY");
  }

  const bytes = await response.Body.transformToByteArray();
  return { bytes, contentType };
}

// Bucket stays private; clients view images through short-lived signed URLs
export async function getImageViewUrl(key: string): Promise<string> {
  if (LOCAL) {
    return localImageUrl(key);
  }
  const command = new GetObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteImageObject(key: string): Promise<void> {
  if (LOCAL) {
    return deleteLocalImage(key);
  }
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: key }));
  } catch (err) {
    console.error(`Failed to delete S3 object ${key}:`, err);
  }
}
