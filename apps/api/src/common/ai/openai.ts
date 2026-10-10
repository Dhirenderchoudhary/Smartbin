import OpenAI from "openai";
import { config } from "../config/config.js";

const MIN_CONFIDENCE = 0.7;

const SYSTEM_PROMPT = `You are a strict verification agent for SmartBin, an app that maps public dustbins in India.
Decide whether the photo clearly shows a dustbin, garbage bin, trash can, or waste container that people can throw waste into.
Count as a dustbin: municipal bins (often green for wet, blue for dry waste), wheelie bins, shop or roadside dustbins, metal or cement bins, drums or containers clearly used as bins.
Do NOT count: loose garbage piles without a container, buckets or boxes not used as bins, drawings or screenshots of bins, or images where no bin is visible.`;

let client: OpenAI | undefined;

function getClient(): OpenAI {
  if (!config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set but VISION_PROVIDER is 'openai'");
  }
  client ??= new OpenAI({ apiKey: config.OPENAI_API_KEY });
  return client;
}

export async function verifyDustbinImageOpenAI(imageBytes: Uint8Array, contentType: string): Promise<boolean> {
  const dataUrl = `data:${contentType};base64,${Buffer.from(imageBytes).toString("base64")}`;

  try {
    const response = await getClient().chat.completions.create({
      model: config.OPENAI_MODEL,
      temperature: 0,
      max_completion_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Does this photo clearly contain a public dustbin?" },
            { type: "image_url", image_url: { url: dataUrl, detail: "auto" } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "dustbin_verification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isDustbin: { type: "boolean" },
              confidence: { type: "number", description: "Confidence from 0.0 to 1.0" },
              reason: { type: "string", description: "One short sentence" },
            },
            required: ["isDustbin", "confidence", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return false;
    }

    const result = JSON.parse(content) as { isDustbin: boolean; confidence: number; reason: string };
    return result.isDustbin === true && result.confidence >= MIN_CONFIDENCE;
  } catch (error) {
    console.error("OpenAI verification failed:", error);
    throw new Error("Failed to verify image with AI");
  }
}
