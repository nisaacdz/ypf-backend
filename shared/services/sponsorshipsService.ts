import dbClient from "@/configs/db";
import { Partnerships } from "@/db/schema/finance";
import { eq, and } from "drizzle-orm";

export const SponsorshipsService = {
  async createSponsorship(data: typeof Partnerships.$inferInsert) {
    const [sponsorship] = await dbClient.db.insert(Partnerships).values({
      ...data,
      partnershipType: "SPONSOR",
    }).returning();
    return sponsorship;
  },

  async getSponsorships() {
    const sponsorships = await dbClient.db.query.Partnerships.findMany({
      where: eq(Partnerships.partnershipType, "SPONSOR"),
      with: {
        organization: true,
        project: true,
        event: true,
      },
    });
    return sponsorships;
  },

  async getSponsorshipById(id: string) {
    const sponsorship = await dbClient.db.query.Partnerships.findFirst({
      where: and(
        eq(Partnerships.id, id),
        eq(Partnerships.partnershipType, "SPONSOR")
      ),
      with: {
        organization: true,
        project: true,
        event: true,
      },
    });
    return sponsorship;
  },

  async updateSponsorship(id: string, data: Partial<typeof Partnerships.$inferInsert>) {
    const [updated] = await dbClient.db
      .update(Partnerships)
      .set(data)
      .where(and(
        eq(Partnerships.id, id),
        eq(Partnerships.partnershipType, "SPONSOR")
      ))
      .returning();
    return updated;
  },

  async deleteSponsorship(id: string) {
    const [deleted] = await dbClient.db
      .delete(Partnerships)
      .where(and(
        eq(Partnerships.id, id),
        eq(Partnerships.partnershipType, "SPONSOR")
      ))
      .returning();
    return deleted;
  },
};
