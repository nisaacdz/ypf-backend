import { and, eq, count, lte, or, isNull, gte } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import * as projectsService from "@/shared/services/projectsService";
import * as eventsService from "@/shared/services/eventsService";
import * as shopService from "@/shared/services/shopService";
import { Activity, Stats } from "@/features/api/v1/dashboard/dtos";

export async function getStats(): Promise<Stats> {
  const [membersCount] = await dbClient.db
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
    );

  const [donationsCount] = await dbClient.db
    .select({ value: count() })
    .from(schema.Donations)
    .innerJoin(
      schema.FinancialTransactions,
      eq(schema.Donations.transactionId, schema.FinancialTransactions.id),
    )
    .where(eq(schema.FinancialTransactions.status, "COMPLETED"));

  const [eventsCount] = await dbClient.db
    .select({ value: count() })
    .from(schema.Events);

  const [projectsCount] = await dbClient.db
    .select({ value: count() })
    .from(schema.Projects);

  return {
    membersCount: membersCount.value,
    donationsCount: donationsCount.value,
    eventsCount: eventsCount.value,
    projectsCount: projectsCount.value,
  };
}

export async function getRecentActivity(): Promise<Activity> {
  const [projects, workshopEvents, shopProducts] =
    await Promise.all([
      projectsService.fetchProjects({
        page: 1,
        pageSize: 3,
      }),
      eventsService.fetchEvents({
        page: 1,
        pageSize: 3,
        filterType: "WORKSHOP",
      }),
      shopService.fetchShopProducts({
        page: 1,
        pageSize: 3,
      }),
    ]);

  return {
    projects,
    workshopEvents,
    shopProducts,
  };
}
