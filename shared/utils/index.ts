import schema from "@/db/schema";

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
