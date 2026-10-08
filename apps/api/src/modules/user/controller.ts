import { Request, Response, NextFunction } from "express";
import { getUserQuota } from "./service.js";
import { ApiResponse } from "../../common/http/ApiResponse.js";

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    res.status(200).json(
      ApiResponse.success({
        id: user.id,
        sub: user.sub,
        email: user.email ?? null,
        role: user.role,
        groups: user.groups,
      })
    );
  } catch (error) {
    next(error);
  }
}

export async function getQuota(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const quota = await getUserQuota(req.user!.id);
    res.status(200).json(ApiResponse.success(quota));
  } catch (error) {
    next(error);
  }
}

export async function adminPing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(
      ApiResponse.success({ user: req.user }, "Admin authentication successful!")
    );
  } catch (error) {
    next(error);
  }
}

