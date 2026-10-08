import { Request, Response, NextFunction } from "express";
import { getNearbyBins, createBin, reportMissingBin } from "./service.js";
import { generateUploadUrl } from "../../common/storage/s3.js";
import { ApiResponse } from "../../common/http/ApiResponse.js";

export async function getPresignedUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { contentType } = req.query;
    if (!contentType || typeof contentType !== "string") {
      res.status(400).json(ApiResponse.error("contentType query parameter is required (e.g., image/jpeg)"));
      return;
    }
    
    const result = await generateUploadUrl(contentType);
    res.status(200).json(ApiResponse.success(result, "Presigned URL generated successfully"));
  } catch (error) {
    next(error);
  }
}

export async function getNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : undefined;

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json(ApiResponse.error("Valid lat and lng query parameters are required."));
      return;
    }
    if (radius !== undefined && isNaN(radius)) {
      res.status(400).json(ApiResponse.error("If provided, radius must be a valid number in meters."));
      return;
    }

    const bins = await getNearbyBins(lat, lng, radius);
    res.status(200).json(ApiResponse.success(bins));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const newBin = await createBin(req.body);
    res.status(201).json(ApiResponse.success(newBin, "Dustbin created successfully", 201));
  } catch (error: any) {
    if (error.message.includes("Image rejected") || error.message.includes("already exists within 15 meters")) {
      res.status(400).json(ApiResponse.error(error.message, 400));
      return;
    }
    next(error);
  }
}

export async function reportMissing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json(ApiResponse.error("Dustbin ID is required"));
      return;
    }

    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined || typeof lat !== "number" || typeof lng !== "number") {
      res.status(400).json(ApiResponse.error("You must provide your current 'lat' and 'lng' as numbers in the request body to verify your location."));
      return;
    }
    
    const result = await reportMissingBin(id, lat, lng);
    
    const message = result.statusChanged 
      ? `Dustbin marked as MISSING after reaching missing report threshold.`
      : `Missing report logged successfully. Total reports: ${result.missingReports}`;
      
    res.status(200).json(ApiResponse.success(result, message));
  } catch (error: any) {
    if (error.message === "Dustbin not found") {
      res.status(404).json(ApiResponse.error("Dustbin not found", 404));
      return;
    }
    if (error.message.includes("GPS Validation Failed")) {
      res.status(400).json(ApiResponse.error(error.message, 400));
      return;
    }
    next(error);
  }
}
