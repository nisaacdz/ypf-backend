import dbClient from "@/configs/db";
import { Registrations } from "@/db/schema/core";
import { eq, desc, count, and, ilike, or } from "drizzle-orm";
import { CreateRegistrationInput, UpdateRegistrationStatusInput } from "@/features/api/v1/registrations/schema";
import { ApiError } from "@/shared/types";

export async function createRegistration(data: CreateRegistrationInput) {
  const [registration] = await dbClient.db
    .insert(Registrations)
    .values({
      ...data,
      status: 'pending',
    })
    .returning();
  
  return registration;
}

export async function getRegistrations(query: { page: number; pageSize: number; status?: string; search?: string }) {
  const { page, pageSize, status, search } = query;
  const offset = (page - 1) * pageSize;
  
  const conditions = [];
  if (status) conditions.push(eq(Registrations.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(Registrations.email, `%${search}%`),
        ilike(Registrations.firstName, `%${search}%`),
        ilike(Registrations.lastName, `%${search}%`)
      )
    );
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [items, totalResult] = await Promise.all([
    dbClient.db
      .select()
      .from(Registrations)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)
      .orderBy(desc(Registrations.createdAt)),
    dbClient.db
      .select({ count: count() })
      .from(Registrations)
      .where(whereClause)
  ]);
  
  return {
    items,
    total: Number(totalResult[0]?.count || 0),
    page,
    pageSize
  };
}

export async function getRegistrationById(id: string) {
  const registration = await dbClient.db.query.Registrations.findFirst({
    where: eq(Registrations.id, id),
    with: {
      passportPhoto: true,
      ghanaCardFront: true,
      ghanaCardBack: true,
      chapter: true,
    }
  });
  
  if (!registration) throw new ApiError("Registration not found", 404);
  return registration;
}

export async function updateRegistrationStatus(id: string, data: UpdateRegistrationStatusInput, adminId: string) {
  const [updated] = await dbClient.db
    .update(Registrations)
    .set({
      status: data.status,
      declinedReason: data.declinedReason,
      assignedRole: data.assignedRole,
      approvedBy: adminId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(Registrations.id, id))
    .returning();
    
  if (!updated) throw new ApiError("Registration not found", 404);
  return updated;
}

export async function getRegistrationStats() {
  const stats = await dbClient.db
    .select({
      status: Registrations.status,
      count: count(),
    })
    .from(Registrations)
    .groupBy(Registrations.status);
    
  return stats;
}
