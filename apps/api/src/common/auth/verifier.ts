import { CognitoJwtVerifier } from "aws-jwt-verify";
import { config } from "../config/config.js";

export const cognitoVerifier = CognitoJwtVerifier.create({
  userPoolId: config.COGNITO_USER_POOL_ID,
  tokenUse: "access",
  clientId: [config.MOBILE_CLIENT_ID, config.ADMIN_CLIENT_ID],
});

export interface AuthUser {
  id: string;
  sub: string;
  email?: string;
  groups: string[];
  role: "USER" | "ADMIN";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
