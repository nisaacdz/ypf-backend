/**
 * DTO for a dues payment response
 */
export type YPFDuesPayment = {
  id: string;
  amount: string;
  currency: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  createdAt: Date;
};

/**
 * DTO for dues information
 */
export type YPFDues = {
  id: string;
  amount: string;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
};

/**
 * DTO for dues payment with period info (for payment history)
 */
export type YPFDuesPaymentWithPeriod = YPFDuesPayment & {
  duesId: string;
  periodStart: Date;
  periodEnd: Date;
};

/**
 * DTO for dues with payment status for a specific member
 */
export type YPFMemberDuesStatus = {
  dues: YPFDues;
  totalPaid: string;
  remainingBalance: string;
  isFullyPaid: boolean;
  payments: YPFDuesPayment[];
};

/**
 * Response for initiating a dues payment
 */
export type YPFDuesPaymentInitiation = {
  paymentId: string;
  paymentUrl: string;
};
