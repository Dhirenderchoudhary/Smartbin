import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../../common/http/ApiResponse.js";
import {
  deleteBin,
  getBinDetails,
  getBinsForMap,
  getStats,
  getTimeseries,
  listBins,
  listEvents,
  listUsers,
  updateBin,
} from "./service.js";
import {
  binIdParams,
  binPatchBody,
  binsListQuery,
  eventsQuery,
  settingsBody,
  timeseriesQuery,
  usersQuery,
} from "./schemas.js";
import { getAdminSettings, updateAdminSettings } from "./settings.js";

export async function stats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ApiResponse.success(await getStats()));
  } catch (error) {
    next(error);
  }
}

export async function timeseries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { days } = timeseriesQuery.parse(req.query);
    res.status(200).json(ApiResponse.success(await getTimeseries(days)));
  } catch (error) {
    next(error);
  }
}

export async function bins(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = binsListQuery.parse(req.query);
    res.status(200).json(ApiResponse.success(await listBins(query)));
  } catch (error) {
    next(error);
  }
}

export async function binsMap(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ApiResponse.success(await getBinsForMap()));
  } catch (error) {
    next(error);
  }
}

export async function binDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = binIdParams.parse(req.params);
    res.status(200).json(ApiResponse.success(await getBinDetails(id)));
  } catch (error) {
    next(error);
  }
}

export async function patchBin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = binIdParams.parse(req.params);
    const body = binPatchBody.parse(req.body);
    const bin = await updateBin(req.user!.id, id, body);
    res.status(200).json(ApiResponse.success(bin, "Dustbin updated"));
  } catch (error) {
    next(error);
  }
}

export async function removeBin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = binIdParams.parse(req.params);
    const result = await deleteBin(req.user!.id, id);
    res.status(200).json(ApiResponse.success(result, "Dustbin deleted"));
  } catch (error) {
    next(error);
  }
}

export async function events(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = eventsQuery.parse(req.query);
    res.status(200).json(ApiResponse.success(await listEvents(query)));
  } catch (error) {
    next(error);
  }
}

export async function settings(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(ApiResponse.success(await getAdminSettings()));
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = settingsBody.parse(req.body);
    const result = await updateAdminSettings(req.user!.id, body);
    const message = result.changed.length > 0 ? "Settings updated" : "No changes";
    res.status(200).json(ApiResponse.success(result, message));
  } catch (error) {
    next(error);
  }
}

export async function usersList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, pageSize } = usersQuery.parse(req.query);
    res.status(200).json(ApiResponse.success(await listUsers(page, pageSize)));
  } catch (error) {
    next(error);
  }
}
