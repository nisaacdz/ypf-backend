import {
  pgSchema,
  uuid,
  decimal,
  varchar,
  timestamp,
  text,
  boolean,
  date,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Chapters, Constituents, Organizations } from "./core";
import { Events, Projects } from "./activities";
import { PaymentMethod, TransactionStatus, MembershipType, PartnershipType } from "./enums";

const finance = pgSchema("finance");

// === TABLES ===

export const FinancialTransactions = finance.table("financial_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  paymentMethod: PaymentMethod("payment_method").notNull(),
  status: TransactionStatus("status").default("PENDING").notNull(),
  externalRef: text("external_ref"),
});

export const Designations = finance.table("designations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  isRestricted: boolean("is_restricted").default(false).notNull(),
  description: text("description"),
});

export const Donations = finance.table("donations", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id")
    .notNull()
    .unique()
    .references(() => FinancialTransactions.id, { onDelete: "restrict" }),
  donorId: uuid("donor_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
  eventId: uuid("event_id").references(() => Events.id, {
    onDelete: "set null",
  }),
  designationId: uuid("designation_id").references(() => Designations.id, {
    onDelete: "set null",
  }),
  receiptSent: boolean("receipt_sent").default(false).notNull(),
});

export const Dues = finance.table("dues", {
  id: uuid("id").defaultRandom().primaryKey(),
  membershipType: MembershipType("membership_type").notNull(),
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
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "restrict" }),
});

export const Expenditures = finance.table("expenditures", {
  id: uuid("id").defaultRandom().primaryKey(),
  expenditureDate: timestamp("expenditure_date", {
    withTimezone: true,
  }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  description: text("description").notNull(),
  category: text("category"),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "restrict",
  }),
  eventId: uuid("event_id").references(() => Events.id, {
    onDelete: "set null",
  }),
  vendorId: uuid("vendor_id").references(() => Organizations.id, {
    onDelete: "set null",
  }),
  approvedById: uuid("approved_by_id").references(() => Constituents.id, {
    onDelete: "restrict",
  }),
});

export const Partnerships = finance.table("partnerships", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => Organizations.id, { onDelete: "restrict" }),
  partnershipType: PartnershipType("partnership_type").notNull(),
  projectId: uuid("project_id").references(() => Projects.id, { onDelete: "set null" }),
  eventId: uuid("event_id").references(() => Events.id, { onDelete: "set null" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  value: decimal("value", { precision: 12, scale: 2 }), // monetary value if applicable
  description: text("description"),
  contractUrl: text("contract_url"), // link to stored contract document
});

// === RELATIONS ===

export const financialTransactionsRelations = relations(
  FinancialTransactions,
  ({ one }) => ({
    donation: one(Donations, {
      fields: [FinancialTransactions.id],
      references: [Donations.transactionId],
    }),
    duesPayment: one(DuesPayments, {
      fields: [FinancialTransactions.id],
      references: [DuesPayments.transactionId],
    }),
  }),
);

export const donationsRelations = relations(Donations, ({ one }) => ({
  transaction: one(FinancialTransactions, {
    fields: [Donations.transactionId],
    references: [FinancialTransactions.id],
  }),
  donor: one(Constituents, {
    fields: [Donations.donorId],
    references: [Constituents.id],
  }),
  project: one(Projects, {
    fields: [Donations.projectId],
    references: [Projects.id],
  }),
  event: one(Events, { fields: [Donations.eventId], references: [Events.id] }),
  designation: one(Designations, {
    fields: [Donations.designationId],
    references: [Designations.id],
  }),
}));

export const duesRelations = relations(Dues, ({ one, many }) => ({
  chapter: one(Chapters, {
    fields: [Dues.chapterId],
    references: [Chapters.id],
  }),
  payments: many(DuesPayments),
}));

export const duesPaymentsRelations = relations(DuesPayments, ({ one }) => ({
  transaction: one(FinancialTransactions, {
    fields: [DuesPayments.transactionId],
    references: [FinancialTransactions.id],
  }),
  dues: one(Dues, { fields: [DuesPayments.duesId], references: [Dues.id] }),
  constituent: one(Constituents, {
    fields: [DuesPayments.constituentId],
    references: [Constituents.id],
  }),
}));

export const expendituresRelations = relations(Expenditures, ({ one }) => ({
  project: one(Projects, {
    fields: [Expenditures.projectId],
    references: [Projects.id],
  }),
  event: one(Events, {
    fields: [Expenditures.eventId],
    references: [Events.id],
  }),
  vendor: one(Organizations, {
    fields: [Expenditures.vendorId],
    references: [Organizations.id],
  }),
  approvedBy: one(Constituents, {
    fields: [Expenditures.approvedById],
    references: [Constituents.id],
  }),
}));
