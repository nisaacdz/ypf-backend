import {
  pgSchema,
  uuid,
  decimal,
  varchar,
  timestamp,
  text,
  date,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Chapters, Donors, Members, Organizations } from "./core";
import { Events, Projects } from "./activities";
import { PaymentMethod, TransactionStatus, PartnershipType } from "./enums";

export const finance = pgSchema("finance");

// === TABLES ===

export const FinancialTransactions = finance.table("financial_transactions", {
  id: uuid().defaultRandom().primaryKey(),
  amount: decimal({ precision: 10, scale: 2 }).notNull(),
  currency: varchar({ length: 3 }).notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  paymentMethod: PaymentMethod("payment_method").notNull(),
  status: TransactionStatus().default("PENDING").notNull(),
  externalRef: text("external_ref"),
});

export const Donations = finance.table("donations", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id")
    .notNull()
    .unique()
    .references(() => FinancialTransactions.id, { onDelete: "restrict" }),
  donorId: uuid("donor_id")
    .notNull()
    .references(() => Donors.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
  eventId: uuid("event_id").references(() => Events.id, {
    onDelete: "set null",
  }),
});

export const Dues = finance.table("dues", {
  id: uuid("id").defaultRandom().primaryKey(),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "set null",
  }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
});

export const DuesPayments = finance.table("dues_payments", {
  id: serial("id").primaryKey(),
  transactionId: uuid("transaction_id")
    .notNull()
    .unique()
    .references(() => FinancialTransactions.id, { onDelete: "restrict" }),
  duesId: uuid("dues_id")
    .notNull()
    .references(() => Dues.id, { onDelete: "restrict" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => Members.id, { onDelete: "restrict" }),
});

export const Expenditures = finance.table("expenditures", {
  id: uuid().defaultRandom().primaryKey(),
  timestamp: timestamp({ withTimezone: true }).notNull(),
  amount: decimal({ precision: 12, scale: 2 }).notNull(),
  currency: varchar({ length: 3 }).notNull(),
  description: text().notNull(),
  category: text(),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "restrict",
  }),
  eventId: uuid("event_id").references(() => Events.id, {
    onDelete: "set null",
  }),
  vendorId: uuid("vendor_id").references(() => Organizations.id, {
    onDelete: "set null",
  }),
});

export const Partnerships = finance.table("partnerships", {
  id: uuid().defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => Organizations.id, { onDelete: "restrict" }),
  partnershipType: PartnershipType("partnership_type").notNull(),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
  eventId: uuid("event_id").references(() => Events.id, {
    onDelete: "set null",
  }),
  startedAt: date("started_at").notNull(),
  endedAt: date("ended_at"),
  value: decimal({ precision: 12, scale: 2 }), // monetary value if applicable
  metadata: text(),
  // contractUrl: text("contract_url"), // lets create a documents table and reference it with documentId
});

// === RELATIONS ===
// === RELATIONS (Corrected and Completed) ===

export const financialTransactionsRelations = relations(
  FinancialTransactions,
  ({ one }) => ({
    // A financial transaction can be one donation (or null)
    donation: one(Donations, {
      fields: [FinancialTransactions.id],
      references: [Donations.transactionId],
    }),
    // A financial transaction can be one dues payment (or null)
    duesPayment: one(DuesPayments, {
      fields: [FinancialTransactions.id],
      references: [DuesPayments.transactionId],
    }),
  }),
);

export const donationsRelations = relations(Donations, ({ one }) => ({
  // A donation is a type of financial transaction
  transaction: one(FinancialTransactions, {
    fields: [Donations.transactionId],
    references: [FinancialTransactions.id],
  }),
  // A donation comes from one donor
  donor: one(Donors, {
    // CORRECTED: Was Members, now correctly Donors
    fields: [Donations.donorId],
    references: [Donors.id],
  }),
  // A donation can be associated with a project
  project: one(Projects, {
    fields: [Donations.projectId],
    references: [Projects.id],
  }),
  // A donation can be associated with an event
  event: one(Events, { fields: [Donations.eventId], references: [Events.id] }),
}));

export const duesRelations = relations(Dues, ({ one, many }) => ({
  // A due can be specific to a chapter
  chapter: one(Chapters, {
    fields: [Dues.chapterId],
    references: [Chapters.id],
  }),
  // A single due (e.g., "2024 Annual Dues") can have many payments against it
  payments: many(DuesPayments),
}));

export const duesPaymentsRelations = relations(DuesPayments, ({ one }) => ({
  // A dues payment is a type of financial transaction
  transaction: one(FinancialTransactions, {
    fields: [DuesPayments.transactionId],
    references: [FinancialTransactions.id],
  }),
  // A payment is for a specific due
  dues: one(Dues, { fields: [DuesPayments.duesId], references: [Dues.id] }),
  // A payment is made by a specific member
  member: one(Members, {
    fields: [DuesPayments.memberId],
    references: [Members.id],
  }),
}));

export const expendituresRelations = relations(Expenditures, ({ one }) => ({
  // An expenditure can be tied to a project
  project: one(Projects, {
    fields: [Expenditures.projectId],
    references: [Projects.id],
  }),
  // An expenditure can be tied to an event
  event: one(Events, {
    fields: [Expenditures.eventId],
    references: [Events.id],
  }),
  // An expenditure can be paid to a vendor (an organization)
  vendor: one(Organizations, {
    fields: [Expenditures.vendorId],
    references: [Organizations.id],
  }),
}));

export const partnershipsRelations = relations(Partnerships, ({ one }) => ({
  // ADDED: Missing relations block for Partnerships
  organization: one(Organizations, {
    fields: [Partnerships.organizationId],
    references: [Organizations.id],
  }),
  project: one(Projects, {
    fields: [Partnerships.projectId],
    references: [Projects.id],
  }),
  event: one(Events, {
    fields: [Partnerships.eventId],
    references: [Events.id],
  }),
}));
