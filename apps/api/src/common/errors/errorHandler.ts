import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiError } from "../http/ApiError.js";
import { config } from "../config/config.js";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue?.path.join(".");
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: issue ? (field ? `${field}: ${issue.message}` : issue.message) : "Invalid request.",
        details: { issues: err.issues },
      },
    });
    return;
  }

  // Body over the express.raw / express.json size limit
  if (err?.type === "entity.too.large") {
    res.status(400).json({
      success: false,
      error: { code: "UNSUPPORTED_MEDIA", message: "Image is too large. The limit is 5 MB." },
    });
    return;
  }

  console.error("Unhandled Error:", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        config.NODE_ENV === "production"
          ? "An unexpected error occurred."
          : err?.message || "An unexpected error occurred.",
    },
  });
}
