import { config } from "../config/config.js";
import { verifyDustbinImageBedrock } from "./bedrock.js";
import { verifyDustbinImageOpenAI } from "./openai.js";

// Single entry point for the bin photo check; VISION_PROVIDER picks the model backend
export function verifyDustbinImage(imageBytes: Uint8Array, contentType: string): Promise<boolean> {
  return config.VISION_PROVIDER === "bedrock"
    ? verifyDustbinImageBedrock(imageBytes, contentType)
    : verifyDustbinImageOpenAI(imageBytes, contentType);
}
