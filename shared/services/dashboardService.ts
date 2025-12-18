import dbClient from "@/configs/db";
import { Members } from "@/db/schema/core";
import { FinancialTransactions } from "@/db/schema/finance";
import { Events, Projects } from "@/db/schema/activities";
import { sql, eq } from "drizzle-orm";

export const DashboardService = {
  async getStats() {
    const [membersCount] = await dbClient.db.select({ count: sql<number>`count(*)` }).from(Members);
    
    const [donationsTotal] = await dbClient.db
      .select({ total: sql<number>`sum(${FinancialTransactions.amount})` })
      .from(FinancialTransactions)
      .where(eq(FinancialTransactions.status, "COMPLETED"));
      
    const [eventsCount] = await dbClient.db.select({ count: sql<number>`count(*)` }).from(Events);
    const [projectsCount] = await dbClient.db.select({ count: sql<number>`count(*)` }).from(Projects);

    return {
      members: Number(membersCount.count),
      donations: Number(donationsTotal?.total || 0),
      events: Number(eventsCount.count),
      projects: Number(projectsCount.count),
    };
  },

  async getRecentActivity() {
    // This is a simplified version. Ideally we'd have an activity log.
    // For now, let's fetch recent members and transactions.
    
    const recentMembers = await dbClient.db.query.Members.findMany({
      limit: 5,
      orderBy: (members, { desc }) => [desc(members.startedAt)],
      with: {
        constituent: true,
      },
    });

    const recentTransactions = await dbClient.db.query.FinancialTransactions.findMany({
      limit: 5,
      orderBy: (tx, { desc }) => [desc(tx.createdAt)],
    });

    return {
      recentMembers,
      recentTransactions,
    };
  },
};
