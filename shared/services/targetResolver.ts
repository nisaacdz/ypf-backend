import dbClient from "@/configs/db";
import schema from "@/db/schema";
import {
  AudienceRule,
  AtomicRule,
  CompositeRule,
} from "@/shared/types/targeting";
import {
  eq,
  and,
  or,
  inArray,
  gte,
  lte,
  isNull,
  isNotNull,
  sql,
} from "drizzle-orm";

/**
 * Resolves an AudienceRule into a set of unique constituent IDs.
 */
export async function resolveAudience(
  rule: AudienceRule,
): Promise<Set<{ id: string, email: string }>> {
  // TODO: Implement this
  return new Set();
}

// async function resolveCompositeRule(rule: CompositeRule): Promise<Set<string>> {
//   switch (rule.op) {
//     case "OR": {
//       const results = await Promise.all(rule.rules.map(resolveAudience));
//       const union = new Set<string>();
//       for (const res of results) {
//         for (const id of res) {
//           union.add(id);
//         }
//       }
//       return union;
//     }
//     case "AND": {
//       if (rule.rules.length === 0) return new Set();
//       const results = await Promise.all(rule.rules.map(resolveAudience));
//       // Start with the first set and intersect with the rest
//       let intersection = results[0];
//       for (let i = 1; i < results.length; i++) {
//         const nextSet = results[i];
//         intersection = new Set([...intersection].filter((x) => nextSet.has(x)));
//       }
//       return intersection;
//     }
//     case "NOT": {
//       const excludeSet = await resolveAudience(rule.rule);
//       const allConstituents = await getAllConstituentIds();
//       const difference = new Set(
//         [...allConstituents].filter((x) => !excludeSet.has(x)),
//       );
//       return difference;
//     }
//   }
// }

// async function resolveAtomicRule(rule: AtomicRule): Promise<Set<{ id: string, email: string }>> {
//   switch (rule.kind) {
//     case "CONSTITUENTS":
//       return resolveAllConstituents(rule);
//     case "SPECIFIC_USERS":
//       return new Set(rule.constituentIds);
//     case "MEMBERS":
//       return resolveMembers(rule);
//     case "VOLUNTEERS":
//       return resolveVolunteers(rule);
//     case "ADMINS":
//       return resolveAdmins(rule);
//     case "PROFILES":
//       return resolveProfiles(rule);
//     case "LEADERS":
//       return resolveLeaders(rule);
//     case "DONORS":
//       return resolveDonors(rule);
//     default:
//       return new Set();
//   }
// }

// // --- Helper Resolvers ---

// async function getAllConstituentIds(): Promise<Set<string>> {
//   const result = await dbClient.db
//     .select({ id: schema.Constituents.id })
//     .from(schema.Constituents);
//   return new Set(result.map((r) => r.id));
// }

// async function resolveAllConstituents(
//   rule: Extract<AtomicRule, { kind: "CONSTITUENTS" }>,
// ): Promise<Set<{ id: string, email: string }>> {
//   // Start with base query
//   let query = dbClient.db
//     .select({ id: schema.Constituents.id, email: schema.Constituents.email })
//     .from(schema.Constituents);

//   const result = await query;
//   return new Set(result.map((r) => ({ id: r.id, email: r.email })));
// }

// async function resolveMembers(
//   rule: Extract<AtomicRule, { kind: "MEMBERS" }>,
// ): Promise<Set<string>> {
//   // Base: Members table
//   // We might need to join with ChapterMemberships, CommitteeMemberships, MemberTitlesAssignments

//   // This is complex because of the "status" (ACTIVE/PAST/ALL) which depends on startedAt/endedAt
//   const now = new Date();

//   // 1. Filter Members table first
//   const memberConditions = [];
//   if (rule.status === "ACTIVE") {
//     memberConditions.push(
//       or(isNull(schema.Members.endedAt), gte(schema.Members.endedAt, now)),
//     );
//   } else if (rule.status === "PAST") {
//     memberConditions.push(lte(schema.Members.endedAt, now));
//   }

//   let query = dbClient.db
//     .select({ constituentId: schema.Members.constituentId })
//     .from(schema.Members);

//   if (memberConditions.length > 0) {
//     query.where(and(...memberConditions));
//   }

//   // If scope or roles are defined, we need to filter further.
//   // Since Drizzle query builder is a bit rigid with dynamic joins in this context,
//   // we might fetch IDs and filter, or build a more complex query.
//   // For simplicity and correctness, let's handle scope/roles by querying related tables
//   // and intersecting.

//   const memberIds = new Set((await query).map((r) => r.constituentId));

//   if (rule.scope) {
//     let scopeIds = new Set<string>();
//     if (rule.scope.chapterId) {
//       const chapterMembers = await dbClient.db
//         .select({ constituentId: schema.Members.constituentId })
//         .from(schema.ChapterMemberships)
//         .innerJoin(
//           schema.Members,
//           eq(schema.ChapterMemberships.memberId, schema.Members.id),
//         )
//         .where(eq(schema.ChapterMemberships.chapterId, rule.scope.chapterId));
//       chapterMembers.forEach((m) => scopeIds.add(m.constituentId));
//     }
//     if (rule.scope.committeeId) {
//       const committeeMembers = await dbClient.db
//         .select({ constituentId: schema.Members.constituentId })
//         .from(schema.CommitteeMemberships)
//         .innerJoin(
//           schema.Members,
//           eq(schema.CommitteeMemberships.memberId, schema.Members.id),
//         )
//         .where(
//           eq(schema.CommitteeMemberships.committeeId, rule.scope.committeeId),
//         );
//       committeeMembers.forEach((m) => scopeIds.add(m.constituentId));
//     }
//     // Intersect
//     memberIds.forEach((id) => {
//       if (!scopeIds.has(id)) memberIds.delete(id);
//     });
//   }

//   if (rule.roles && rule.roles.length > 0) {
//     const roleIds = new Set<string>();
//     const titleAssignments = await dbClient.db
//       .select({ constituentId: schema.Members.constituentId })
//       .from(schema.MemberTitlesAssignments)
//       .innerJoin(
//         schema.MemberTitles,
//         eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
//       )
//       .innerJoin(
//         schema.Members,
//         eq(schema.MemberTitlesAssignments.memberId, schema.Members.id),
//       )
//       .where(inArray(schema.MemberTitles.title, rule.roles));

//     titleAssignments.forEach((m) => roleIds.add(m.constituentId));

//     // Intersect
//     memberIds.forEach((id) => {
//       if (!roleIds.has(id)) memberIds.delete(id);
//     });
//   }

//   return memberIds;
// }

// async function resolveVolunteers(
//   rule: Extract<AtomicRule, { kind: "VOLUNTEERS" }>,
// ): Promise<Set<string>> {
//   const now = new Date();
//   const conditions = [];

//   if (rule.status === "ACTIVE") {
//     conditions.push(
//       or(
//         isNull(schema.Volunteers.endedAt),
//         gte(schema.Volunteers.endedAt, now),
//       ),
//     );
//   } else if (rule.status === "PAST") {
//     conditions.push(lte(schema.Volunteers.endedAt, now));
//   }

//   const result = await dbClient.db
//     .select({ constituentId: schema.Volunteers.constituentId })
//     .from(schema.Volunteers)
//     .where(and(...conditions));

//   return new Set(result.map((r) => r.constituentId));
// }

// async function resolveAdmins(
//   rule: Extract<AtomicRule, { kind: "ADMINS" }>,
// ): Promise<Set<string>> {
//   const now = new Date();
//   const conditions = [];

//   if (rule.status === "ACTIVE") {
//     conditions.push(
//       or(isNull(schema.Admins.endedAt), gte(schema.Admins.endedAt, now)),
//     );
//   } else if (rule.status === "PAST") {
//     conditions.push(lte(schema.Admins.endedAt, now));
//   }

//   let query = dbClient.db
//     .select({ constituentId: schema.Admins.constituentId })
//     .from(schema.Admins);

//   if (conditions.length > 0) {
//     query.where(and(...conditions));
//   }

//   const adminIds = new Set((await query).map((r) => r.constituentId));

//   if (rule.roles && rule.roles.length > 0) {
//     const roleIds = new Set<string>();
//     const roleAssignments = await dbClient.db
//       .select({ constituentId: schema.Admins.constituentId })
//       .from(schema.AdminRolesAssignments)
//       .innerJoin(
//         schema.Admins,
//         eq(schema.AdminRolesAssignments.adminId, schema.Admins.id),
//       )
//       .where(inArray(schema.AdminRolesAssignments.role, rule.roles));

//     roleAssignments.forEach((m) => roleIds.add(m.constituentId));

//     // Intersect
//     adminIds.forEach((id) => {
//       if (!roleIds.has(id)) adminIds.delete(id);
//     });
//   }

//   return adminIds;
// }

// async function resolveProfiles(
//   rule: Extract<AtomicRule, { kind: "PROFILES" }>,
// ): Promise<Set<string>> {
//   const now = new Date();
//   let table;

//   switch (rule.profileType) {
//     case "DIRECTOR":
//       table = schema.Directors;
//       break;
//     case "AUDITOR":
//       table = schema.Auditors;
//       break;
//   }

//   const conditions = [];
//   if (rule.status === "ACTIVE") {
//     conditions.push(or(isNull(table.endedAt), gte(table.endedAt, now)));
//   } else if (rule.status === "PAST") {
//     conditions.push(lte(table.endedAt, now));
//   }

//   const result = await dbClient.db
//     .select({ constituentId: table.constituentId })
//     .from(table)
//     .where(and(...conditions));

//   return new Set(result.map((r) => r.constituentId));
// }

// async function resolveLeaders(
//   rule: Extract<AtomicRule, { kind: "LEADERS" }>,
// ): Promise<Set<string>> {
//   const now = new Date();
//   const status = rule.status || "ACTIVE";
//   const leaderIds = new Set<string>();

//   // 1. Members with Titles
//   const memberConditions = [];
//   if (status === "ACTIVE") {
//     memberConditions.push(
//       or(isNull(schema.Members.endedAt), gte(schema.Members.endedAt, now)),
//     );
//   } else if (status === "PAST") {
//     memberConditions.push(lte(schema.Members.endedAt, now));
//   }

//   const titledMembers = await dbClient.db
//     .select({ constituentId: schema.Members.constituentId })
//     .from(schema.MemberTitlesAssignments)
//     .innerJoin(
//       schema.Members,
//       eq(schema.MemberTitlesAssignments.memberId, schema.Members.id),
//     )
//     .where(and(...memberConditions)); // We assume having an assignment implies leadership

//   titledMembers.forEach((m) => leaderIds.add(m.constituentId));

//   // 2. Admins with Roles
//   const adminConditions = [];
//   if (status === "ACTIVE") {
//     adminConditions.push(
//       or(isNull(schema.Admins.endedAt), gte(schema.Admins.endedAt, now)),
//     );
//   } else if (status === "PAST") {
//     adminConditions.push(lte(schema.Admins.endedAt, now));
//   }

//   const roleAdmins = await dbClient.db
//     .select({ constituentId: schema.Admins.constituentId })
//     .from(schema.AdminRolesAssignments)
//     .innerJoin(
//       schema.Admins,
//       eq(schema.AdminRolesAssignments.adminId, schema.Admins.id),
//     )
//     .where(and(...adminConditions));

//   roleAdmins.forEach((a) => leaderIds.add(a.constituentId));

//   return leaderIds;
// }

// async function resolveDonors(
//   rule: Extract<AtomicRule, { kind: "DONORS" }>,
// ): Promise<Set<string>> {
//   // Query Donations joined with FinancialTransactions
//   // Filter by amount, currency, period

//   const conditions = [];

//   if (rule.currency) {
//     conditions.push(eq(schema.FinancialTransactions.currency, rule.currency));
//   }

//   if (rule.period) {
//     if (rule.period.start) {
//       conditions.push(
//         gte(
//           schema.FinancialTransactions.createdAt,
//           new Date(rule.period.start),
//         ),
//       );
//     }
//     if (rule.period.end) {
//       conditions.push(
//         lte(schema.FinancialTransactions.createdAt, new Date(rule.period.end)),
//       );
//     }
//   }

//   // Aggregate
//   const totals = new Map<string, number>();
//   // We need to fetch amount as well
//   const transactionsWithAmount = await dbClient.db
//     .select({
//       constituentId: schema.Donations.constituentId,
//       amount: schema.FinancialTransactions.amount,
//     })
//     .from(schema.Donations)
//     .innerJoin(
//       schema.FinancialTransactions,
//       eq(schema.Donations.transactionId, schema.FinancialTransactions.id),
//     )
//     .where(and(isNotNull(schema.Donations.constituentId), ...conditions));

//   for (const tx of transactionsWithAmount) {
//     if (!tx.constituentId) continue;
//     const amount = parseFloat(tx.amount);
//     totals.set(tx.constituentId, (totals.get(tx.constituentId) || 0) + amount);
//   }

//   const qualifiedIds = new Set<string>();
//   for (const [id, total] of totals.entries()) {
//     if (!rule.minTotalDonation || total >= rule.minTotalDonation) {
//       qualifiedIds.add(id);
//     }
//   }

//   return qualifiedIds;
// }
