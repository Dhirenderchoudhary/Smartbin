import { config } from "../config/config.js";
import { verifyDustbinImageBedrock } from "./bedrock.js";
import { checkDustbinImageOpenAI, type DustbinCheck } from "./openai.js";

// Single entry point for the bin photo check; VISION_PROVIDER picks the model backend
export async function verifyDustbinImage(imageBytes: Uint8Array, contentType: string): Promise<boolean> {
  return (await checkDustbinImage(imageBytes, contentType)).accepted;
}

// Same check with the model's confidence and reason where the provider gives them (eval script, logs)
export async function checkDustbinImage(imageBytes: Uint8Array, contentType: string): Promise<DustbinCheck> {
  if (config.VISION_PROVIDER === "off") {
    return { accepted: true, isDustbin: true, confidence: 1, reason: "Photo check is off (VISION_PROVIDER=off)" };
  }
  if (config.VISION_PROVIDER === "bedrock") {
    const ok = await verifyDustbinImageBedrock(imageBytes, contentType);
    return { accepted: ok, isDustbin: ok, confidence: ok ? 1 : 0, reason: "Bedrock gives a yes/no answer only" };
  }
  return checkDustbinImageOpenAI(imageBytes, contentType);
}
