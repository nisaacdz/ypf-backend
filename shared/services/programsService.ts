import dbClient from "@/configs/db";
import { Programs, ProgramEnrollments } from "@/db/schema/activities";
import { eq, and, desc, count } from "drizzle-orm";
import { CreateProgramInput, UpdateProgramInput } from "@/features/api/v1/programs/schema";
import { ApiError } from "@/shared/types";

export async function createProgram(data: CreateProgramInput, createdBy: string) {
  const [program] = await dbClient.db
    .insert(Programs)
    .values({
      ...data,
      budget: data.budget ? data.budget.toString() : undefined,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      createdBy,
    })
    .returning();
  return program;
}

export async function getPrograms(query: { page: number; pageSize: number; type?: string; status?: string }) {
  const { page, pageSize, type, status } = query;
  const offset = (page - 1) * pageSize;
  
  const conditions = [];
  if (type) conditions.push(eq(Programs.type, type));
  if (status) conditions.push(eq(Programs.status, status));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [items, totalResult] = await Promise.all([
    dbClient.db.query.Programs.findMany({
      where: whereClause,
      limit: pageSize,
      offset: offset,
      with: {
        committee: true,
        chapter: true,
      },
      orderBy: desc(Programs.startDate),
    }),
    dbClient.db
      .select({ count: count() })
      .from(Programs)
      .where(whereClause)
  ]);
  
  return {
    items,
    total: Number(totalResult[0]?.count || 0),
    page,
    pageSize
  };
}

export async function getProgramById(id: string) {
  const program = await dbClient.db.query.Programs.findFirst({
    where: eq(Programs.id, id),
    with: {
      committee: true,
      chapter: true,
      enrollments: {
        with: {
          member: {
            with: {
              constituent: true
            }
          }
        }
      }
    }
  });
  
  if (!program) throw new ApiError("Program not found", 404);
  return program;
}

export async function updateProgram(id: string, data: UpdateProgramInput) {
  const [updated] = await dbClient.db
    .update(Programs)
    .set({
      ...data,
      budget: data.budget ? data.budget.toString() : undefined,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(Programs.id, id))
    .returning();
    
  if (!updated) throw new ApiError("Program not found", 404);
  return updated;
}

export async function deleteProgram(id: string) {
  const [deleted] = await dbClient.db
    .delete(Programs)
    .where(eq(Programs.id, id))
    .returning();
    
  if (!deleted) throw new ApiError("Program not found", 404);
  return deleted;
}

export async function enrollMember(programId: string, memberId: string) {
  // Check if already enrolled
  const existing = await dbClient.db.query.ProgramEnrollments.findFirst({
    where: and(
      eq(ProgramEnrollments.programId, programId),
      eq(ProgramEnrollments.memberId, memberId)
    )
  });
  
  if (existing) throw new ApiError("Member already enrolled", 400);
  
  const [enrollment] = await dbClient.db
    .insert(ProgramEnrollments)
    .values({
      programId,
      memberId,
    })
    .returning();
    
  return enrollment;
}

export async function withdrawMember(programId: string, memberId: string) {
  const [updated] = await dbClient.db
    .update(ProgramEnrollments)
    .set({
      status: 'withdrawn',
      completedAt: new Date(), // Using completedAt to mark end of participation
    })
    .where(and(
      eq(ProgramEnrollments.programId, programId),
      eq(ProgramEnrollments.memberId, memberId)
    ))
    .returning();
    
  if (!updated) throw new ApiError("Enrollment not found", 404);
  return updated;
}
