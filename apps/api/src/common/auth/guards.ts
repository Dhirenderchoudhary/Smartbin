import { Request, Response, NextFunction } from "express";
import { ApiError } from "../http/ApiError.js";

export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(ApiError.unauthorized("Authentication required."));
  }

  if (req.user.role !== "ADMIN" && !req.user.groups.includes("ADMIN")) {
    return next(ApiError.forbidden("Access denied. Admin privileges required."));
  }

  next();
}

export function requireUser(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(ApiError.unauthorized("Authentication required."));
  }

  next();
}
