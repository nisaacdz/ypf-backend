import dbClient from "@/configs/db";
import { Certificates } from "@/db/schema/activities";
import { eq } from "drizzle-orm";

export const CertificatesService = {
  async issueCertificate(data: typeof Certificates.$inferInsert) {
    const [certificate] = await dbClient.db.insert(Certificates).values(data).returning();
    return certificate;
  },

  async getCertificateById(id: string) {
    const certificate = await dbClient.db.query.Certificates.findFirst({
      where: eq(Certificates.id, id),
      with: {
        recipient: true,
        event: true,
        program: true,
        issuer: true,
      },
    });
    return certificate;
  },

  async getMemberCertificates(memberId: string) {
    const certificates = await dbClient.db.query.Certificates.findMany({
      where: eq(Certificates.recipientId, memberId),
      with: {
        event: true,
        program: true,
      },
      orderBy: (certificates, { desc }) => [desc(certificates.issueDate)],
    });
    return certificates;
  },

  async getAllCertificates() {
    const certificates = await dbClient.db.query.Certificates.findMany({
      with: {
        recipient: true,
        event: true,
        program: true,
        issuer: true,
      },
      orderBy: (certificates, { desc }) => [desc(certificates.issueDate)],
    });
    return certificates;
  },

  async updateCertificate(id: string, data: Partial<typeof Certificates.$inferInsert>) {
    const [updated] = await dbClient.db
      .update(Certificates)
      .set(data)
      .where(eq(Certificates.id, id))
      .returning();
    return updated;
  },

  async deleteCertificate(id: string) {
    const [deleted] = await dbClient.db
      .delete(Certificates)
      .where(eq(Certificates.id, id))
      .returning();
    return deleted;
  },
};
