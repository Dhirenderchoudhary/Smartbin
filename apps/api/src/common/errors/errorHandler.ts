import { Request, Response, NextFunction } from "express";
import { ApiError } from "../http/ApiError.js";

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
      },
    });
    return;
  }

  console.error("Unhandled Error:", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: err?.message || "An unexpected error occurred.",
    },
  });
}
