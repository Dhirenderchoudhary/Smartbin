import { CognitoIdentityProviderClient, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { config } from "../config/config.js";

const client = new CognitoIdentityProviderClient({ region: config.AWS_REGION });

// Access tokens carry no email claim; GetUser reads it with the user's own token (no IAM needed)
export async function fetchEmailFromCognito(accessToken: string): Promise<string | undefined> {
  try {
    const result = await client.send(new GetUserCommand({ AccessToken: accessToken }));
    return result.UserAttributes?.find((a) => a.Name === "email")?.Value;
  } catch (err) {
    console.error("Cognito GetUser failed:", err);
    return undefined;
  }
}
