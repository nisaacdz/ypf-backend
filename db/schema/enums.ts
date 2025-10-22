import { pgEnum } from "drizzle-orm/pg-core";

export const MediumType = pgEnum("media_type", ["PICTURE", "VIDEO"]);
export const ContactType = pgEnum("contact_type", [
  "EMAIL",
  "PHONE",
  "WHATSAPP",
]);
export const ProjectStatus = pgEnum("project_status", [
  "UPCOMING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
export const EventStatus = pgEnum("event_status", [
  "UPCOMING",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);
export const PaymentMethod = pgEnum("payment_method", [
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "MOBILE_MONEY",
  "CASH",
]);
export const TransactionStatus = pgEnum("transaction_status", [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
]);
export const AttendanceStatus = pgEnum("attendance_status", [
  "INVITED",
  "ACCEPTED",
  "DECLINED",
  "ATTENDED",
]);
export const Gender = pgEnum("gender", ["MALE", "FEMALE", "OTHER"]);
export const PartnershipType = pgEnum("partnership_type", [
  "SPONSOR",
  "IN_KIND",
  "TECHNICAL",
  "VENUE",
  "OTHER",
]);
export const NotificationType = pgEnum("notification_type", [
  "OTHER",
  "MEETING_INVITE",
  "DONATION_RECEIPT",
  "ANNOUNCEMENT",
]);
