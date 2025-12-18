import dbClient from "@/configs/db";
import { Dues, DuesPayments, FinancialTransactions } from "@/db/schema/finance";
import { Members } from "@/db/schema/core";
import { eq, and, desc } from "drizzle-orm";
import { CreateDuesInput, PayDuesInput, UpdateDuesInput } from "@/features/api/v1/dues/schema";
import { ApiError } from "@/shared/types";

export async function createDues(data: CreateDuesInput) {
  const [dues] = await dbClient.db
    .insert(Dues)
    .values({
      ...data,
      amount: data.amount.toString(),
    })
    .returning();
  return dues;
}

export async function getDues(query: { page: number; pageSize: number; chapterId?: string }) {
  const { page, pageSize, chapterId } = query;
  const offset = (page - 1) * pageSize;
  
  const conditions = [];
  if (chapterId) conditions.push(eq(Dues.chapterId, chapterId));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const items = await dbClient.db.query.Dues.findMany({
    where: whereClause,
    limit: pageSize,
    offset: offset,
    with: {
      chapter: true,
    },
    orderBy: desc(Dues.periodStart),
  });
  
  return { items, page, pageSize };
}

export async function getDuesById(id: string) {
  const dues = await dbClient.db.query.Dues.findFirst({
    where: eq(Dues.id, id),
    with: {
      chapter: true,
    }
  });
  if (!dues) throw new ApiError("Dues configuration not found", 404);
  return dues;
}

export async function updateDues(id: string, data: UpdateDuesInput) {
  const [updated] = await dbClient.db
    .update(Dues)
    .set({
      ...data,
      amount: data.amount ? data.amount.toString() : undefined,
    })
    .where(eq(Dues.id, id))
    .returning();
  if (!updated) throw new ApiError("Dues configuration not found", 404);
  return updated;
}

export async function payDues(constituentId: string, data: PayDuesInput) {
  const member = await dbClient.db.query.Members.findFirst({
    where: eq(Members.constituentId, constituentId),
  });
  
  if (!member) throw new ApiError("User is not a member", 400);

  // 1. Create Financial Transaction
  const [transaction] = await dbClient.db
    .insert(FinancialTransactions)
    .values({
      amount: data.amount.toString(),
      currency: data.currency,
      paymentMethod: data.paymentMethod,
      status: 'COMPLETED', 
      externalProvider: 'PAYSTACK', 
      externalRef: data.reference,
    })
    .returning();
    
  // 2. Create Dues Payment Record
  const [payment] = await dbClient.db
    .insert(DuesPayments)
    .values({
      duesId: data.duesId,
      memberId: member.id,
      transactionId: transaction.id,
    })
    .returning();
    
  return payment;
}

export async function getMemberDuesHistory(constituentId: string) {
  const member = await dbClient.db.query.Members.findFirst({
    where: eq(Members.constituentId, constituentId),
  });
  
  if (!member) throw new ApiError("User is not a member", 400);

  const history = await dbClient.db.query.DuesPayments.findMany({
    where: eq(DuesPayments.memberId, member.id),
    with: {
      dues: true,
      transaction: true,
    },
    // orderBy: desc(DuesPayments.id), 
  });
  return history;
}
