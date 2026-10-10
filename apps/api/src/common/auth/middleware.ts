import { Request, Response, NextFunction, RequestHandler } from "express";
import { cognitoVerifier } from "./verifier.js";
import { config } from "../config/config.js";
import { fetchEmailFromCognito } from "./cognito.js";
import { syncUserByCognitoSub } from "../../modules/user/service.js";
import { ApiError } from "../http/ApiError.js";

interface CognitoAccessPayload {
  sub: string;
  email?: string;
  username?: string;
  "cognito:groups"?: string[];
}

// AUTH_MODE=dev: the bearer token is the email itself; DEV_ADMIN_EMAILS stands in for the Cognito ADMIN group
function devPayload(token: string): CognitoAccessPayload | undefined {
  const email = token.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return undefined;
  const admins = config.DEV_ADMIN_EMAILS.toLowerCase().split(",").map((e) => e.trim());
  return { sub: `dev:${email}`, email, "cognito:groups": admins.includes(email) ? ["ADMIN"] : [] };
}

export const authenticateToken: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return next(ApiError.unauthorized("Missing or invalid Authorization header. Expected Bearer token."));
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(ApiError.unauthorized("Missing token in Authorization header."));
  }

  let payload: CognitoAccessPayload;
  if (config.AUTH_MODE === "dev") {
    const dev = devPayload(token);
    if (!dev) {
      return next(ApiError.unauthorized("Local mode expects the token to be an email address."));
    }
    payload = dev;
  } else {
    try {
      payload = await cognitoVerifier.verify(token) as CognitoAccessPayload;
    } catch (err: unknown) {
      // Log token failures at debug level internally if using a logger
      return next(ApiError.unauthorized("The provided access token is invalid or expired."));
    }
  }

  try {
    const sub = payload.sub;
    const email = payload.email || undefined;
    const groups: string[] = payload["cognito:groups"] || [];
    const role: "USER" | "ADMIN" = groups.includes("ADMIN") ? "ADMIN" : "USER";

    const dbUser = await syncUserByCognitoSub(sub, email, role, () => fetchEmailFromCognito(token));

    req.user = {
      id: dbUser.id,
      sub,
      email: dbUser.email ?? email,
      groups,
      role,
    };

    next();
  } catch (err: unknown) {
    console.error("Database user sync error:", err);
    return next(ApiError.internal("Failed to authenticate user context due to a server error."));
  }
};

