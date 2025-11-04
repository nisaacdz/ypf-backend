import variables from "@/configs/env";
import logger from "@/configs/logger";
import { transactionStatusMap, paymentMethodMap } from "../utils";
import schema from "@/db/schema";

/**
 * Payment provider interface for future extensibility.
 * This allows adding other payment gateways (Stripe, Flutterwave, etc.)
 * in the future without changing the core transaction logic.
 */

export type PaymentProvider =
  (typeof schema.ExternalProviderEnum.enumValues)[number];
export type PaymentMethod =
  (typeof schema.PaymentMethodEnum.enumValues)[number];
export type TransactionStatus =
  (typeof schema.TransactionStatusEnum.enumValues)[number];

export type VerifyTransactionResult = {
  success: boolean;
  status: TransactionStatus;
  amount: number;
  currency: string;
  channel: PaymentMethod;
  reference: string;
  paidAt?: string;
};

export interface IPaymentProvider {
  name: PaymentProvider;

  /**
   * Verify a transaction with the payment provider's API.
   * This should be called by verify endpoints to confirm payment status.
   */
  verifyTransaction(reference: string): Promise<VerifyTransactionResult>;

  /**
   * Map provider-specific status to our internal status enum.
   */
  mapStatus(providerStatus: string): TransactionStatus;

  /**
   * Map provider-specific payment channel to our internal payment method enum.
   */
  mapPaymentMethod(providerChannel: string): PaymentMethod;
}

/**
 * Paystack payment provider implementation
 */
export class PaystackProvider implements IPaymentProvider {
  name = "PAYSTACK" as const;
  private secretKey: string;

  constructor() {
    this.secretKey = variables.services.paystack.secretHash;
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    try {
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        logger.error("Paystack verification failed:", errorData);
        throw new Error(
          `Paystack API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (!data.status) {
        throw new Error(data.message || "Verification failed");
      }

      return {
        success: true,
        status: data.data.status,
        amount: data.data.amount,
        currency: data.data.currency,
        channel: data.data.channel,
        reference: data.data.reference,
        paidAt: data.data.paid_at,
      };
    } catch (error) {
      logger.error({ error }, "Error verifying Paystack transaction");
      throw error;
    }
  }

  mapStatus(providerStatus: string): TransactionStatus {
    return transactionStatusMap[providerStatus] || "PENDING";
  }

  mapPaymentMethod(providerChannel: string): PaymentMethod {
    return paymentMethodMap[providerChannel] || "CREDIT_CARD";
  }
}

/**
 * Factory function to get the appropriate payment provider.
 * This makes it easy to add new providers in the future.
 */
export function getPaymentProvider(
  providerName: string,
): IPaymentProvider | null {
  switch (providerName.toUpperCase()) {
    case "PAYSTACK":
      return new PaystackProvider();
    // Add more providers here in the future:
    // case "STRIPE":
    //   return new StripeProvider();
    // case "FLUTTERWAVE":
    //   return new FlutterwaveProvider();
    default:
      logger.warn(`Unknown payment provider: ${providerName}`);
      return null;
  }
}
