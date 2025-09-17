import { pgEnum } from "drizzle-orm/pg-core";

export const MembershipType = pgEnum("membership_type", [
  "DONOR",
  "MEMBER",
  "VOLUNTEER",
  "AUDITOR",
  "ADMIN",
]);
export const MediaType = pgEnum("media_type", ["PICTURE", "VIDEO"]);
export const ContactType = pgEnum("contact_type", [
  "EMAIL",
  "PHONE",
  "WHATSAPP",
]);
export const ProjectStatus = pgEnum("project_status", [
  "PLANNING",
  "IN_PROGRESS",
  "COMPLETED",
  "ON_HOLD",
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
