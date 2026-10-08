import { Request, Response, NextFunction } from "express";
import { checkHealth } from "./service.js";
import { ApiResponse } from "../../common/http/ApiResponse.js";

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await checkHealth();
    res.status(200).json(ApiResponse.success(data, "System operational"));
  } catch (error) {
    next(error);
  }
}

