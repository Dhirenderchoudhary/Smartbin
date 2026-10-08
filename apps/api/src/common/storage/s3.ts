import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config/config.js";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({ region: config.AWS_REGION });

export async function generateUploadUrl(contentType: string): Promise<{ uploadUrl: string; fileUrl: string }> {
  const extension = contentType.split("/")[1] || "jpeg";
  const fileName = `dustbins/${uuidv4()}-${Date.now()}.${extension}`;
  
  const command = new PutObjectCommand({
    Bucket: config.S3_BUCKET_NAME,
    Key: fileName,
    ContentType: contentType,
  });
  
  // Presigned URL valid for 5 minutes
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  const fileUrl = `https://${config.S3_BUCKET_NAME}.s3.${config.AWS_REGION}.amazonaws.com/${fileName}`;
  
  return { uploadUrl, fileUrl };
}
