import express, { Router } from "express";
import cors from "cors";
import { config } from "./common/config/config.js";
import { authenticateToken } from "./common/auth/middleware.js";
import { requireAdmin } from "./common/auth/guards.js";
import { errorHandler } from "./common/errors/errorHandler.js";

import * as HealthController from "./modules/health/controller.js";
import * as UserController from "./modules/user/controller.js";
import * as DustbinController from "./modules/dustbin/controller.js";
import * as AdminController from "./modules/admin/controller.js";

const app = express();

// Global Middleware
app.use(cors({ origin: config.CORS_ORIGINS.split(",") }));
app.use(express.json());

// Single Router Instance
const apiRouter = Router();

// --- Module: Health ---
apiRouter.get("/health", HealthController.getHealth);

// --- Module: User ---
apiRouter.get("/me", authenticateToken, UserController.getProfile);
apiRouter.get("/me/quota", authenticateToken, UserController.getQuota);

// --- Module: Dustbin ---
apiRouter.get("/dustbins/upload-url", authenticateToken, DustbinController.getPresignedUrl);
apiRouter.get("/dustbins/nearby", authenticateToken, DustbinController.getNearby);
apiRouter.post("/dustbins", authenticateToken, DustbinController.create);
apiRouter.post("/dustbins/:id/report-missing", authenticateToken, DustbinController.reportMissing);

// --- Admin Endpoints ---
const adminOnly = [authenticateToken, requireAdmin];
apiRouter.get("/admin/ping", adminOnly, UserController.adminPing);
apiRouter.get("/admin/stats", adminOnly, AdminController.stats);
apiRouter.get("/admin/stats/timeseries", adminOnly, AdminController.timeseries);
apiRouter.get("/admin/bins", adminOnly, AdminController.bins);
apiRouter.get("/admin/bins/map", adminOnly, AdminController.binsMap);
apiRouter.get("/admin/bins/:id", adminOnly, AdminController.binDetails);
apiRouter.patch("/admin/bins/:id", adminOnly, AdminController.patchBin);
apiRouter.delete("/admin/bins/:id", adminOnly, AdminController.removeBin);
apiRouter.get("/admin/events", adminOnly, AdminController.events);
apiRouter.get("/admin/users", adminOnly, AdminController.usersList);

// Mount single router under /v1
app.use("/v1", apiRouter);

// 404 Route Handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "The requested API endpoint does not exist.",
    },
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Express Server
app.listen(config.PORT, () => {
  console.log(`🚀 SmartBin API server listening on http://localhost:${config.PORT}`);
  console.log(`🔒 Cognito Auth Pool: ${config.COGNITO_USER_POOL_ID}`);
});
