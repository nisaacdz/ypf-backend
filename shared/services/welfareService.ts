import dbClient from "@/configs/db";
import { WelfareCases } from "@/db/schema/activities";
import { eq, and } from "drizzle-orm";

export const WelfareService = {
  async createCase(data: typeof WelfareCases.$inferInsert) {
    const [welfareCase] = await dbClient.db.insert(WelfareCases).values(data).returning();
    return welfareCase;
  },

  async getCases(filters?: { status?: string; type?: string; memberId?: string }) {
    const whereConditions = [];
    if (filters?.status) whereConditions.push(eq(WelfareCases.status, filters.status as any));
    if (filters?.type) whereConditions.push(eq(WelfareCases.type, filters.type as any));
    if (filters?.memberId) whereConditions.push(eq(WelfareCases.memberId, filters.memberId));

    const cases = await dbClient.db.query.WelfareCases.findMany({
      where: whereConditions.length ? and(...whereConditions) : undefined,
      with: {
        member: true,
        assignee: true,
        chapter: true,
      },
      orderBy: (cases, { desc }) => [desc(cases.createdAt)],
    });
    return cases;
  },

  async getCaseById(id: string) {
    const welfareCase = await dbClient.db.query.WelfareCases.findFirst({
      where: eq(WelfareCases.id, id),
      with: {
        member: true,
        assignee: true,
        chapter: true,
      },
    });
    return welfareCase;
  },

  async updateCase(id: string, data: Partial<typeof WelfareCases.$inferInsert>) {
    const [updated] = await dbClient.db
      .update(WelfareCases)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(WelfareCases.id, id))
      .returning();
    return updated;
  },

  async assignCase(id: string, assigneeId: string) {
    const [updated] = await dbClient.db
      .update(WelfareCases)
      .set({ assignedTo: assigneeId, status: "UNDER_REVIEW", updatedAt: new Date() })
      .where(eq(WelfareCases.id, id))
      .returning();
    return updated;
  },
};
