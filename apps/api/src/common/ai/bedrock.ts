import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { config } from "../config/config.js";

const client = new BedrockRuntimeClient({ region: config.AWS_REGION });

export async function verifyDustbinImageBedrock(imageBytes: Uint8Array, contentType: string): Promise<boolean> {
  let format = "jpeg";
  if (contentType.includes("png")) format = "png";
  if (contentType.includes("webp")) format = "webp";

  const prompt = `You are a strict AI verification agent. Look at this image. Analyze it and report whether it clearly contains a public dustbin, garbage bin, or trash can.`;

  try {
    const command = new ConverseCommand({
      modelId: config.BEDROCK_MODEL_ID,
      messages: [
        {
          role: "user",
          content: [
            {
              image: {
                format: format as "jpeg" | "png" | "webp" | "gif",
                source: {
                  bytes: imageBytes
                }
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "report_verification",
              description: "Report the results of the dustbin verification analysis.",
              inputSchema: {
                json: {
                  type: "object",
                  properties: {
                    isDustbin: { 
                      type: "boolean", 
                      description: "True if the image clearly contains a dustbin, trash can, or garbage bin. False otherwise."
                    },
                    confidence: {
                      type: "number",
                      description: "Your confidence in this assessment from 0.0 to 1.0"
                    }
                  },
                  required: ["isDustbin"]
                }
              }
            }
          }
        ],
        toolChoice: {
          tool: { name: "report_verification" }
        }
      }
    });

    const response = await client.send(command);
    
    // Find the toolUse block in the response content
    const contentBlocks = response.output?.message?.content || [];
    for (const block of contentBlocks) {
      if (block.toolUse && block.toolUse.name === "report_verification") {
        const input = block.toolUse.input as any;
        return input.isDustbin === true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Bedrock verification failed:", error);
    throw new Error("Failed to verify image with AI");
  }
}
