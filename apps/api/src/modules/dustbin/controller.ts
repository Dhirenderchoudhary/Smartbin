import { Request, Response, NextFunction } from "express";
import { getNearbyBins, createBin, reportMissingBin, reportBinIssue, resolveBinIssues, recordInteraction, logSearch } from "./service.js";
import { generateUploadUrl } from "../../common/storage/s3.js";
import { ApiResponse } from "../../common/http/ApiResponse.js";
import {
  createBody,
  interactionBody,
  nearbyQuery,
  reportMissingBody,
  reportMissingParams,
  reportIssueBody,
  resolveIssueBody,
  uploadUrlQuery,
} from "./schemas.js";

export async function getPresignedUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { contentType } = uploadUrlQuery.parse(req.query);
    const result = await generateUploadUrl(req.user!.id, contentType);
    res.status(200).json(ApiResponse.success(result, "Presigned URL generated successfully"));
  } catch (error) {
    next(error);
  }
}

export async function getNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { lat, lng, radius, log } = nearbyQuery.parse(req.query);
    const bins = await getNearbyBins(lat, lng, radius);
    if (log === "1") {
      // Analytics only: a failed log must not fail the search
      logSearch(lat, lng, bins).catch((err) => console.warn("search log failed", err));
    }
    res.status(200).json(ApiResponse.success(bins));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createBody.parse(req.body);
    const newBin = await createBin(req.user!.id, data);
    res.status(201).json(ApiResponse.success(newBin, "Dustbin created successfully", 201));
  } catch (error) {
    next(error);
  }
}

export async function reportMissing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = reportMissingParams.parse(req.params);
    const { lat, lng } = reportMissingBody.parse(req.body);

    const result = await reportMissingBin(req.user!.id, id, lat, lng);

    const message = result.removed
      ? `Dustbin removed after reaching ${result.threshold} missing reports.`
      : `Missing report logged (${result.missingReports}/${result.threshold}).`;

    res.status(200).json(ApiResponse.success(result, message));
  } catch (error) {
    next(error);
  }
}

export async function reportIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = reportMissingParams.parse(req.params);
    const body = reportIssueBody.parse(req.body);
    res.status(201).json(ApiResponse.success(await reportBinIssue(req.user!.id, id, body), "Problem reported", 201));
  } catch (error) {
    next(error);
  }
}

export async function resolveIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = reportMissingParams.parse(req.params);
    const body = resolveIssueBody.parse(req.body);
    res.status(200).json(ApiResponse.success(await resolveBinIssues(req.user!.id, id, body), "Marked as sorted"));
  } catch (error) {
    next(error);
  }
}

export async function interaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = reportMissingParams.parse(req.params);
    const { type } = interactionBody.parse(req.body);
    res.status(200).json(ApiResponse.success(await recordInteraction(req.user!.id, id, type)));
  } catch (error) {
    next(error);
  }
}
