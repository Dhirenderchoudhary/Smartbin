import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ApiResponse } from "../../common/http/ApiResponse.js";
import { getLatestVisionEval, runVisionEval, tryOwnPhoto } from "./service.js";

const tryBody = z.object({ imageKey: z.string().min(1) });

export async function latest(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ApiResponse.success(await getLatestVisionEval()));
  } catch (error) {
    next(error);
  }
}

export async function run(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await runVisionEval(req.user!.id);
    res.status(201).json(ApiResponse.success({ id: result.id }, "Evaluation finished", 201));
  } catch (error) {
    next(error);
  }
}

export async function tryPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { imageKey } = tryBody.parse(req.body);
    res.status(200).json(ApiResponse.success(await tryOwnPhoto(req.user!.id, imageKey)));
  } catch (error) {
    next(error);
  }
}
