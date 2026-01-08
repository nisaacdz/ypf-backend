import { Request, Response, NextFunction } from "express";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { ApiError } from "@/shared/types";
import logger from "@/configs/logger";

export async function getJobStats(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Get queue sizes for different states
    // Note: pg-boss 10.x uses getQueueSize with 'before' option
    // We can get the total queue size and fetch some metadata
    const queueSize = await jobDispatcher.client.getQueueSize("*");

    res.json({
      success: true,
      data: {
        total: queueSize,
        message:
          "Use /list endpoint to fetch jobs with details. Queue size represents pending jobs.",
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get job stats");
    next(new ApiError("Failed to retrieve job statistics", 500));
  }
}

export async function listJobs(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { limit = "50" } = req.query;

    const jobs = await jobDispatcher.client.fetch("*", {
      batchSize: Number(limit),
      includeMetadata: true,
    });

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    logger.error({ error }, "Failed to list jobs");
    next(new ApiError("Failed to retrieve jobs", 500));
  }
}

export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobId } = req.params;
    const { queue = "*" } = req.query;

    const job = await jobDispatcher.client.getJobById(
      queue as string,
      jobId,
      { includeArchive: false },
    );

    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    logger.error({ error }, "Failed to get job");
    next(new ApiError("Failed to retrieve job", 500));
  }
}

export async function retryJob(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { jobId } = req.params;
    const { queue = "*" } = req.query;

    await jobDispatcher.client.resume(queue as string, jobId);

    res.json({
      success: true,
      message: "Job retry initiated",
    });
  } catch (error) {
    logger.error({ error, jobId: req.params.jobId }, "Failed to retry job");
    next(new ApiError("Failed to retry job", 500));
  }
}

export async function cancelJob(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { jobId } = req.params;
    const { queue = "*" } = req.query;

    await jobDispatcher.client.cancel(queue as string, jobId);

    res.json({
      success: true,
      message: "Job cancelled successfully",
    });
  } catch (error) {
    logger.error({ error, jobId: req.params.jobId }, "Failed to cancel job");
    next(new ApiError("Failed to cancel job", 500));
  }
}
