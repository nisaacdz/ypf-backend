import { and, eq, desc } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError } from "@/shared/types";

export type CertificateRow = {
  id: string;
  certificateNumber: string;
  constituentId: string;
  title: string;
  programName: string;
  projectId: string | null;
  type: "COMPLETION" | "PARTICIPATION" | "ACHIEVEMENT" | "LEADERSHIP";
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  issuedAt: Date;
  expiresAt: Date | null;
  issuedBy: string | null;
  description: string | null;
};

export async function getMyCertificates(
  constituentId: string,
): Promise<CertificateRow[]> {
  const rows = await dbClient.db
    .select()
    .from(schema.Certificates)
    .where(eq(schema.Certificates.constituentId, constituentId))
    .orderBy(desc(schema.Certificates.issuedAt));
  return rows as CertificateRow[];
}

export async function getCertificateById(
  id: string,
): Promise<CertificateRow> {
  const [row] = await dbClient.db
    .select()
    .from(schema.Certificates)
    .where(eq(schema.Certificates.id, id))
    .limit(1);
  if (!row) throw new ApiError("Certificate not found", 404);
  return row as CertificateRow;
}

export async function issueCertificate(data: {
  constituentId: string;
  title: string;
  programName: string;
  projectId?: string;
  type?: "COMPLETION" | "PARTICIPATION" | "ACHIEVEMENT" | "LEADERSHIP";
  description?: string;
  expiresAt?: string;
  issuedBy?: string;
}): Promise<string> {
  const [row] = await dbClient.db
    .insert(schema.Certificates)
    .values({
      constituentId: data.constituentId,
      title: data.title,
      programName: data.programName,
      projectId: data.projectId ?? null,
      type: data.type ?? "COMPLETION",
      description: data.description ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      issuedBy: data.issuedBy ?? null,
    })
    .returning({ id: schema.Certificates.id });
  return row.id;
}

export async function revokeCertificate(id: string): Promise<void> {
  const result = await dbClient.db
    .update(schema.Certificates)
    .set({ status: "REVOKED" })
    .where(eq(schema.Certificates.id, id));
}
