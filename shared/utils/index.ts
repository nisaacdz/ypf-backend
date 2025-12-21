import schema from "@/db/schema";
import {
  ApplicationStatusEnum,
  DocumentTypeEnum,
  MediumTypeEnum,
  NationalIdTypeEnum,
  GenderEnum,
} from "@/db/schema/core";

import {
  EventStatusEnum,
  ProjectStatusEnum,
  EventTypeEnum,
} from "@/db/schema/activities";

type TransactionStatus =
  (typeof schema.TransactionStatusEnum.enumValues)[number];
type PaymentMethod = (typeof schema.PaymentMethodEnum.enumValues)[number];

export const transactionStatusMap: Record<string, TransactionStatus> = {
  success: "COMPLETED",
  failed: "FAILED",
  reversed: "REFUNDED",
};

export const paymentMethodMap: Record<string, PaymentMethod> = {
  card: "CREDIT_CARD",
  bank: "BANK_TRANSFER",
  bank_transfer: "BANK_TRANSFER",
  transfer: "BANK_TRANSFER",
  mobile_money: "MOBILE_MONEY",
  ussd: "BANK_TRANSFER",
};

export type NationalIdType = (typeof NationalIdTypeEnum.enumValues)[number];
export type ApplicationStatus =
  (typeof ApplicationStatusEnum.enumValues)[number];
export type DocumentType = (typeof DocumentTypeEnum.enumValues)[number];
export type MediumType = (typeof MediumTypeEnum.enumValues)[number];
export type EventStatus = (typeof EventStatusEnum.enumValues)[number];
export type ProjectStatus = (typeof ProjectStatusEnum.enumValues)[number];
export type EventType = (typeof EventTypeEnum.enumValues)[number];
export type Gender = (typeof GenderEnum.enumValues)[number];
