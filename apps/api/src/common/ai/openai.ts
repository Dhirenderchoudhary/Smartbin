import OpenAI from "openai";
import { config } from "../config/config.js";

const MIN_CONFIDENCE = 0.7;

const SYSTEM_PROMPT = `You are a strict verification agent for SmartBin, an app that maps public dustbins in India.
Decide whether the photo clearly shows a public dustbin: a container made to be a bin, standing or fixed in a public place for anyone to throw waste into.
purpose_made_bin: municipal bins (often green for wet, blue for dry waste), wheelie bins, litter bins, shop or roadside dustbins, metal or cement bins, large waste containers, and traditional bins built as dustbins (for example bamboo or cane bins made for litter).
improvised_bin: a drum, barrel, bucket, box, bag or basket that is not made as a bin, even if waste is in it.
not_a_bin: everything else, including loose garbage piles or garbage bags, look-alike street objects (post boxes, fire hydrants, bollards, planters), drawings or screenshots, and photos where no bin is visible.
Be skeptical: classify by what you can see, not by what an object could be used for.`;

let client: OpenAI | undefined;

function getClient(): OpenAI {
  if (!config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set but VISION_PROVIDER is 'openai'");
  }
  client ??= new OpenAI({ apiKey: config.OPENAI_API_KEY });
  return client;
}

export interface DustbinCheck {
  accepted: boolean;
  isDustbin: boolean;
  confidence: number;
  reason: string;
}

export async function verifyDustbinImageOpenAI(imageBytes: Uint8Array, contentType: string): Promise<boolean> {
  return (await checkDustbinImageOpenAI(imageBytes, contentType)).accepted;
}

// Full answer from the model, used by the API (accepted) and the eval script (confidence, reason)
export async function checkDustbinImageOpenAI(imageBytes: Uint8Array, contentType: string): Promise<DustbinCheck> {
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
              kind: { type: "string", enum: ["purpose_made_bin", "improvised_bin", "not_a_bin"] },
              publicPlacement: {
                type: "boolean",
                description: "True if it stands or is fixed in a public place for anyone to use. False if held or handled by a person, inside a home, or a product/catalogue photo",
              },
              confidence: { type: "number", description: "Confidence in kind, from 0.0 to 1.0" },
              reason: { type: "string", description: "One short sentence" },
            },
            required: ["kind", "publicPlacement", "confidence", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { accepted: false, isDustbin: false, confidence: 0, reason: "No answer from the model" };
    }

    const result = JSON.parse(content) as {
      kind: "purpose_made_bin" | "improvised_bin" | "not_a_bin";
      publicPlacement: boolean;
      confidence: number;
      reason: string;
    };
    // The rule is enforced here, not left to the model's yes/no: only a purpose-made bin in a public
    // place passes. Improvised containers (drums, buckets, bags) are rejected even with waste in them,
    // because a small model readily "sees" waste evidence that isn't there.
    const isDustbin = result.kind === "purpose_made_bin";
    const accepted = isDustbin && result.publicPlacement && result.confidence >= MIN_CONFIDENCE;
    const tag = result.kind === "purpose_made_bin" ? (result.publicPlacement ? "" : " [not in a public place]") : ` [${result.kind}]`;
    return { isDustbin, confidence: result.confidence, reason: `${result.reason}${tag}`, accepted };
  } catch (error) {
    console.error("OpenAI verification failed:", error);
    throw new Error("Failed to verify image with AI");
  }
}
