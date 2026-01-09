import { and, eq, count, lte, or, isNull, gte, desc } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import * as projectsService from "@/shared/services/projectsService";
import * as eventsService from "@/shared/services/eventsService";
import * as shopService from "@/shared/services/shopService";
import {
  Activity,
  Stats,
  MonthlyReport,
} from "@/features/api/v1/dashboard/dtos";

export async function getStats(): Promise<Stats> {
  const [
    [membersCount],
    [donationsCount],
    [eventsCount],
    [projectsCount],
    [welfareProjectsCount],
    latestMonthlyReport,
  ] = await Promise.all([
    dbClient.db
      .select({ value: count() })
      .from(schema.Members)
      .where(
        and(
          eq(schema.Members.constituentId, schema.Constituents.id),
          lte(schema.Members.startedAt, new Date()),
          or(
            isNull(schema.Members.endedAt),
            gte(schema.Members.endedAt, new Date()),
          ),
        ),
      ),
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

  // Map the monthly report to the DTO format
  let monthlyReport: MonthlyReport | null = null;
  if (latestMonthlyReport) {
    monthlyReport = {
      reportMonth: latestMonthlyReport.reportMonth,
      totalDonations: latestMonthlyReport.totalDonations,
      donationsCount: latestMonthlyReport.donationsCount,
      totalDuesPayments: latestMonthlyReport.totalDuesPayments,
      duesPaymentsCount: latestMonthlyReport.duesPaymentsCount,
      totalOrderPayments: latestMonthlyReport.totalOrderPayments,
      orderPaymentsCount: latestMonthlyReport.orderPaymentsCount,
      newMembersCount: latestMonthlyReport.newMembersCount,
      newVolunteersCount: latestMonthlyReport.newVolunteersCount,
      eventsCount: latestMonthlyReport.eventsCount,
      projectsCount: latestMonthlyReport.projectsCount,
      announcementsCount: latestMonthlyReport.announcementsCount,
      generatedAt: latestMonthlyReport.generatedAt,
    };
  }

  return {
    membersCount: membersCount.value,
    donationsCount: donationsCount.value,
    eventsCount: eventsCount.value,
    projectsCount: projectsCount.value,
    welfareProjectsCount: welfareProjectsCount.value,
    monthlyReport,
  };
}

export async function getRecentActivity(): Promise<Activity> {
  const [projects, welfareProjects, workshopEvents, shopProducts] =
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
        filterType: "WORKSHOP",
      }),
      shopService.fetchShopProducts({
        page: 1,
        pageSize: 5,
      }),
    ]);

  return {
    projects: projects.items,
    welfareProjects: welfareProjects.items,
    workshopEvents: workshopEvents.items,
    shopProducts: shopProducts.items,
  };
}
