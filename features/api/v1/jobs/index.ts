import { Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";
import * as jobHandler from "./jobHandler";

const jobsRouter = Router();

// All job management endpoints require admin access
jobsRouter.use(authenticate);
jobsRouter.use(authorize(Visitors.hasProfile("ADMIN")));

// Get job statistics
jobsRouter.get("/stats", jobHandler.getJobStats);

// Get jobs by status
jobsRouter.get("/list", jobHandler.listJobs);

// Get specific job details
jobsRouter.get("/:jobId", jobHandler.getJob);

// Retry a failed job
jobsRouter.post("/:jobId/retry", jobHandler.retryJob);

// Cancel a scheduled job
jobsRouter.post("/:jobId/cancel", jobHandler.cancelJob);

export default jobsRouter;
