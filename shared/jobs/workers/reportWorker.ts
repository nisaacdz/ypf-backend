import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { and, eq, gte, lt, count, sum } from "drizzle-orm";
import logger from "@/configs/logger";
import type { Job } from "pg-boss";

export const reportWorker = {
  /**
   * Generates monthly report with aggregated statistics.
   * Runs on the 1st of each month at 3 AM (configured in scheduler).
   * Collects: donations, dues payments, order payments, new members/volunteers, events, projects, announcements.
   */
  async generateMonthlyReport(jobs: Job[]) {
    for (const job of jobs) {
      try {
        // Calculate the previous month's date range
        const now = new Date();
        const reportMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthStart = new Date(
          reportMonth.getFullYear(),
          reportMonth.getMonth(),
          1,
        );
        const monthEnd = new Date(
          reportMonth.getFullYear(),
          reportMonth.getMonth() + 1,
          1,
        );

        logger.info(
          {
            jobId: job.id,
            reportMonth: reportMonth.toISOString(),
            monthStart: monthStart.toISOString(),
            monthEnd: monthEnd.toISOString(),
          },
          "Starting monthly report generation",
        );

        // Check if report already exists for this month
        const existingReport = await dbClient.db.query.MonthlyReports.findFirst(
          {
            where: eq(schema.MonthlyReports.reportMonth, reportMonth),
          },
        );

        if (existingReport) {
          logger.info(
            { jobId: job.id, reportMonth: reportMonth.toISOString() },
            "Monthly report already exists, skipping generation",
          );
          continue;
        }

        // Gather all statistics in parallel
        const [
          donationsStats,
          duesPaymentsStats,
          orderPaymentsStats,
          newMembersCount,
          newVolunteersCount,
          eventsCount,
          projectsCount,
          announcementsCount,
        ] = await Promise.all([
          // Donations for the month (completed transactions only)
          dbClient.db
            .select({
              count: count(),
              total: sum(schema.FinancialTransactions.amount),
            })
            .from(schema.Donations)
            .innerJoin(
              schema.FinancialTransactions,
              eq(
                schema.Donations.transactionId,
                schema.FinancialTransactions.id,
              ),
            )
            .where(
              and(
                eq(schema.FinancialTransactions.status, "COMPLETED"),
                gte(schema.FinancialTransactions.createdAt, monthStart),
                lt(schema.FinancialTransactions.createdAt, monthEnd),
              ),
            ),

          // Dues payments for the month (completed transactions only)
          dbClient.db
            .select({
              count: count(),
              total: sum(schema.FinancialTransactions.amount),
            })
            .from(schema.DuesPayments)
            .innerJoin(
              schema.FinancialTransactions,
              eq(
                schema.DuesPayments.transactionId,
                schema.FinancialTransactions.id,
              ),
            )
            .where(
              and(
                eq(schema.FinancialTransactions.status, "COMPLETED"),
                gte(schema.FinancialTransactions.createdAt, monthStart),
                lt(schema.FinancialTransactions.createdAt, monthEnd),
              ),
            ),

          // Order payments for the month (completed transactions only)
          dbClient.db
            .select({
              count: count(),
              total: sum(schema.FinancialTransactions.amount),
            })
            .from(schema.OrderPayments)
            .innerJoin(
              schema.FinancialTransactions,
              eq(
                schema.OrderPayments.transactionId,
                schema.FinancialTransactions.id,
              ),
            )
            .where(
              and(
                eq(schema.FinancialTransactions.status, "COMPLETED"),
                gte(schema.FinancialTransactions.createdAt, monthStart),
                lt(schema.FinancialTransactions.createdAt, monthEnd),
              ),
            ),

          // New members (startedAt within the month)
          dbClient.db
            .select({ count: count() })
            .from(schema.Members)
            .where(
              and(
                gte(schema.Members.startedAt, monthStart),
                lt(schema.Members.startedAt, monthEnd),
              ),
            ),

          // New volunteers (startedAt within the month)
          dbClient.db
            .select({ count: count() })
            .from(schema.Volunteers)
            .where(
              and(
                gte(schema.Volunteers.startedAt, monthStart),
                lt(schema.Volunteers.startedAt, monthEnd),
              ),
            ),

          // Events starting in the month
          dbClient.db
            .select({ count: count() })
            .from(schema.Events)
            .where(
              and(
                gte(schema.Events.scheduledStart, monthStart),
                lt(schema.Events.scheduledStart, monthEnd),
              ),
            ),

          // Projects starting in the month
          dbClient.db
            .select({ count: count() })
            .from(schema.Projects)
            .where(
              and(
                gte(schema.Projects.scheduledStart, monthStart),
                lt(schema.Projects.scheduledStart, monthEnd),
              ),
            ),

          // Announcements published in the month
          dbClient.db
            .select({ count: count() })
            .from(schema.Announcements)
            .where(
              and(
                gte(schema.Announcements.publishedAt, monthStart),
                lt(schema.Announcements.publishedAt, monthEnd),
              ),
            ),
        ]);

        // Insert the monthly report
        await dbClient.db.insert(schema.MonthlyReports).values({
          reportMonth,
          totalDonations: donationsStats[0]?.total || "0",
          donationsCount: donationsStats[0]?.count || 0,
          totalDuesPayments: duesPaymentsStats[0]?.total || "0",
          duesPaymentsCount: duesPaymentsStats[0]?.count || 0,
          totalOrderPayments: orderPaymentsStats[0]?.total || "0",
          orderPaymentsCount: orderPaymentsStats[0]?.count || 0,
          newMembersCount: newMembersCount[0]?.count || 0,
          newVolunteersCount: newVolunteersCount[0]?.count || 0,
          eventsCount: eventsCount[0]?.count || 0,
          projectsCount: projectsCount[0]?.count || 0,
          announcementsCount: announcementsCount[0]?.count || 0,
        });

        logger.info(
          {
            jobId: job.id,
            reportMonth: reportMonth.toISOString(),
            donations: donationsStats[0]?.count || 0,
            duesPayments: duesPaymentsStats[0]?.count || 0,
            orderPayments: orderPaymentsStats[0]?.count || 0,
            newMembers: newMembersCount[0]?.count || 0,
            newVolunteers: newVolunteersCount[0]?.count || 0,
          },
          "Monthly report generated successfully",
        );
      } catch (error) {
        logger.error(
          { jobId: job.id, error },
          "Failed to generate monthly report",
        );
        throw error;
      }
    }
  },
};
