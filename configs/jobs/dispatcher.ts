import PgBoss from "pg-boss";
import variables from "@/configs/env";
import logger from "@/configs/logger";

class JobDispatcher {
  private boss: PgBoss | null = null;

  async initialize() {
    if (this.boss) {
      logger.warn("Job dispatcher already initialized");
      return;
    }

    this.boss = new PgBoss({
      connectionString: variables.database.url,
      // Use the default 'pgboss' schema which is automatically created
      // by pg-boss on first initialization
      retryLimit: variables.jobs.retryLimit,
      retryDelay: variables.jobs.retryDelay,
      retryBackoff: true,
      expireInHours: variables.jobs.archiveHours,
      deleteAfterDays: variables.jobs.retentionDays,
      monitorStateIntervalSeconds: 60,
      maintenanceIntervalSeconds: 300, // 5 minutes
      archiveCompletedAfterSeconds: variables.jobs.archiveHours * 3600,
      // Performance tuning
      schedule: true, // Enable cron scheduling
      supervise: true, // Enable job supervision
      pollingIntervalSeconds: 2, // Poll for new jobs every 2 seconds
    });

    this.boss.on("error", (error) => {
      logger.error(error, "pg-boss error");
    });

    this.boss.on("maintenance", () => {
      logger.debug("pg-boss maintenance started");
    });

    this.boss.on("monitor-states", (states) => {
      //logger.debug({ states }, "pg-boss monitor states");

      const failedCount = states.failed || 0;
      const createdCount = states.created || 0;

      if (failedCount > 50) {
        logger.warn({ failedCount }, "High number of failed jobs detected");
      }

      if (createdCount > 1000) {
        logger.warn({ createdCount }, "High number of queued jobs detected");
      }
    });

    await this.boss.start();
    logger.info("Job dispatcher initialized with pg-boss");
  }

  async shutdown() {
    if (this.boss) {
      await this.boss.stop({ timeout: 30000 }); // 30 second graceful shutdown
      logger.info("Job dispatcher shut down gracefully");
      this.boss = null;
    }
  }

  get client() {
    if (!this.boss) {
      throw new Error(
        "Job dispatcher not initialized. Call initialize() first.",
      );
    }
    return this.boss;
  }
}

const jobDispatcher = new JobDispatcher();

export default jobDispatcher;
