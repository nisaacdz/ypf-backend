import { and, eq, count, lte, or, isNull, gte, desc } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import * as projectsService from "@/shared/services/projectsService";
import * as eventsService from "@/shared/services/eventsService";
import * as shopService from "@/shared/services/shopService";
import {
  DashboardStats,
  DashboardActivity,
} from "@/features/api/v1/dashboard/dtos";

export async function getStats(): Promise<DashboardStats> {
  const now = new Date();
  const activeCondition = (
    table: typeof schema.Members | typeof schema.Volunteers,
  ) =>
    and(
      lte(table.startedAt, now),
      or(isNull(table.endedAt), gte(table.endedAt, now)),
    );

  const [
    [membersCount],
    [volunteersCount],
    [donationsCount],
    [eventsCount],
    [projectsCount],
    [welfareProjectsCount],
    latestMonthlyReport,
  ] = await Promise.all([
    dbClient.db
      .select({ value: count() })
      .from(schema.Members)
      .where(activeCondition(schema.Members)),
    dbClient.db
      .select({ value: count() })
      .from(schema.Volunteers)
      .where(activeCondition(schema.Volunteers)),
    dbClient.db
      .select({ value: count() })
      .from(schema.Donations)
      .innerJoin(
        schema.FinancialTransactions,
        eq(schema.Donations.transactionId, schema.FinancialTransactions.id),
      )
      .where(eq(schema.FinancialTransactions.status, "COMPLETED")),
    dbClient.db.select({ value: count() }).from(schema.Events),
    dbClient.db.select({ value: count() }).from(schema.Projects),
    dbClient.db
      .select({ value: count() })
      .from(schema.Projects)
      .where(eq(schema.Projects.type, "WELFARE")),
    dbClient.db.query.MonthlyReports.findFirst({
      orderBy: [desc(schema.MonthlyReports.reportMonth)],
    }),
  ]);

  const result: DashboardStats = {
    counts: {
      members: membersCount.value,
      volunteers: volunteersCount.value,
      donations: donationsCount.value,
      events: eventsCount.value,
      projects: projectsCount.value,
      welfareProjects: welfareProjectsCount.value,
    },
  };

  if (latestMonthlyReport) {
    result.latestReport = {
      reportMonth: latestMonthlyReport.reportMonth,
      generatedAt: latestMonthlyReport.generatedAt,
      financials: {
        totalDonations: latestMonthlyReport.totalDonations || "0",
        donationsCount: latestMonthlyReport.donationsCount || 0,
        totalDuesPayments: latestMonthlyReport.totalDuesPayments || "0",
        duesPaymentsCount: latestMonthlyReport.duesPaymentsCount || 0,
        totalOrderPayments: latestMonthlyReport.totalOrderPayments || "0",
        orderPaymentsCount: latestMonthlyReport.orderPaymentsCount || 0,
      },
      activity: {
        newMembersCount: latestMonthlyReport.newMembersCount || 0,
        newVolunteersCount: latestMonthlyReport.newVolunteersCount || 0,
        eventsCount: latestMonthlyReport.eventsCount || 0,
        projectsCount: latestMonthlyReport.projectsCount || 0,
        announcementsCount: latestMonthlyReport.announcementsCount || 0,
      },
    };
  }

  return result;
}

export async function getRecentActivity(): Promise<DashboardActivity> {
  const [communityProjects, welfareProjects, events, shopProducts] =
    await Promise.all([
      projectsService.fetchProjects({
        page: 1,
        pageSize: 5,
        filterType: "COMMUNITY",
      }),
      projectsService.fetchProjects({
        page: 1,
        pageSize: 5,
        filterType: "WELFARE",
      }),
      eventsService.fetchEvents({
        page: 1,
        pageSize: 5,
      }),
      shopService.fetchShopProducts({
        page: 1,
        pageSize: 5,
      }),
    ]);

  return {
    projects: {
      community: communityProjects.items,
      welfare: welfareProjects.items,
    },
    events: events.items,
    shopProducts: shopProducts.items,
  };
}
