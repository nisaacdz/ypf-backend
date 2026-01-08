import { Request, Response, NextFunction } from "express";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { ApiError } from "@/shared/types";
import logger from "@/configs/logger";
import { JobNames } from "@/shared/jobs/types/definitions";

// Valid queue names that can be used for job operations
const validQueueNames = new Set(Object.values(JobNames));

/**
 * Validates and returns a queue name.
 * If the queue is '*' or not specified, returns a default job name for fetching.
 * Otherwise validates that the queue name is one of our defined job names.
 */
function validateQueueName(queue: string | undefined): string {
  if (!queue || queue === "*") {
    // Use first job name as a fallback - operations may still fail
    // if the job ID doesn't belong to this queue
    return JobNames.SEND_EMAIL;
  }

  if (!validQueueNames.has(queue as (typeof JobNames)[keyof typeof JobNames])) {
    throw new ApiError(
      `Invalid queue name. Valid options: ${Array.from(validQueueNames).join(", ")}`,
      400,
    );
  }

  return queue;
}

export async function getJobStats(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Get queue sizes - using '*' as wildcard is supported for getQueueSize
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

    // Wildcard '*' is supported for fetch operations
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
    const { queue } = req.query;

    // Validate queue name for getJobById operation
    const queueName = validateQueueName(queue as string | undefined);

    const job = await jobDispatcher.client.getJobById(queueName, jobId, {
      includeArchive: false,
    });

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
    const { queue } = req.query;

    // Validate queue name for resume operation
    const queueName = validateQueueName(queue as string | undefined);

    await jobDispatcher.client.resume(queueName, jobId);

    res.json({
      success: true,
      message: "Job retry initiated",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
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
    const { queue } = req.query;

    // Validate queue name for cancel operation
    const queueName = validateQueueName(queue as string | undefined);

    await jobDispatcher.client.cancel(queueName, jobId);

    res.json({
      success: true,
      message: "Job cancelled successfully",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    logger.error({ error, jobId: req.params.jobId }, "Failed to cancel job");
    next(new ApiError("Failed to cancel job", 500));
  }
}
