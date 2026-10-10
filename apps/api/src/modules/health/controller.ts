import { Request, Response, NextFunction } from "express";
import { checkHealth } from "./service.js";
import { ApiResponse } from "../../common/http/ApiResponse.js";

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await checkHealth();
    if (!data.db) {
      res.status(503).json(new ApiResponse(503, "Database unavailable", data));
      return;
    }
    res.status(200).json(ApiResponse.success(data, "System operational"));
  } catch (error) {
    next(error);
  }
}
