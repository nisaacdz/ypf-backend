import crypto from "crypto";
import flutterwaveConfig from "@/configs/finance";
import logger from "@/configs/logger";

/**
 * Financial Transactions Utility Module
 *
 * This module provides comprehensive utilities for integrating with Flutterwave
 * payment gateway to handle financial transactions including donations, dues,
 * and shop purchases.
 */

/**
 * Payment data required to initialize a transaction
 */
export interface PaymentInitializationData {
  /** Transaction reference - must be unique */
  txRef: string;
  /** Amount to be charged */
  amount: number;
  /** Currency code (e.g., "NGN", "USD", "GHS") */
  currency: string;
  /** URL to redirect after successful payment */
  redirectUrl: string;
  /** Customer information */
  customer: {
    email: string;
    phoneNumber?: string;
    name: string;
  };
  /** Additional metadata to attach to the transaction */
  meta?: Record<string, unknown>;
  /** Payment options to enable (e.g., ["card", "mobilemoney", "ussd"]) */
  paymentOptions?: string;
  /** Custom title for the payment page */
  customizations?: {
    title?: string;
    description?: string;
    logo?: string;
  };
}

/**
 * Response from Flutterwave transaction initialization
 */
export interface PaymentInitializationResponse {
  status: "success" | "error";
  message: string;
  data?: {
    link: string;
  };
}

/**
 * Transaction verification response from Flutterwave
 */
export interface TransactionVerificationResponse {
  status: "success" | "error";
  message: string;
  data?: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: "successful" | "failed" | "pending";
    payment_type: string;
    created_at: string;
    customer: {
      id: number;
      email: string;
      phone_number: string;
      name: string;
    };
    meta?: Record<string, unknown>;
  };
}

/**
 * Webhook event data structure from Flutterwave
 */
export interface FlutterwaveWebhookEvent {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: string;
    payment_type: string;
    created_at: string;
    customer: {
      id: number;
      email: string;
      phone_number: string;
      name: string;
    };
    meta?: Record<string, unknown>;
  };
}

/**
 * Initialize a payment transaction with Flutterwave
 *
 * This function creates a payment link that can be used to redirect customers
 * to complete their payment. It supports various payment methods including
 * cards, mobile money, bank transfers, and USSD.
 *
 * @param paymentData - The payment initialization data
 * @returns A promise that resolves to the payment initialization response
 *
 * @example
 * ```typescript
 * const response = await initializeTransaction({
 *   txRef: "TXN-" + Date.now(),
 *   amount: 5000,
 *   currency: "NGN",
 *   redirectUrl: "https://yourapp.com/verify-payment",
 *   customer: {
 *     email: "user@example.com",
 *     name: "John Doe",
 *     phoneNumber: "+2348012345678"
 *   },
 *   meta: {
 *     type: "donation",
 *     projectId: "proj-123"
 *   },
 *   customizations: {
 *     title: "YPF Donation",
 *     description: "Support our cause"
 *   }
 * });
 *
 * if (response.status === "success") {
 *   // Redirect user to response.data.link
 *   console.log("Payment link:", response.data.link);
 * }
 * ```
 */
export async function initializeTransaction(
  paymentData: PaymentInitializationData,
): Promise<PaymentInitializationResponse> {
  try {
    const payload = {
      tx_ref: paymentData.txRef,
      amount: paymentData.amount,
      currency: paymentData.currency,
      redirect_url: paymentData.redirectUrl,
      customer: {
        email: paymentData.customer.email,
        phonenumber: paymentData.customer.phoneNumber,
        name: paymentData.customer.name,
      },
      meta: paymentData.meta,
      payment_options: paymentData.paymentOptions,
      customizations: paymentData.customizations,
    };

    const response = await fetch(
      `${flutterwaveConfig.baseUrl}/payments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flutterwaveConfig.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        status: "error",
        message: result.message || "Failed to initialize payment",
      };
    }

    return {
      status: "success",
      message: "Payment initialized successfully",
      data: {
        link: result.data.link,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred",
    };
  }
}

/**
 * Verify a transaction status with Flutterwave
 *
 * This function should be called after a customer completes payment to verify
 * the transaction status and retrieve transaction details. Always verify
 * transactions on your server before updating your database.
 *
 * @param transactionId - The Flutterwave transaction ID or transaction reference
 * @returns A promise that resolves to the transaction verification response
 *
 * @example
 * ```typescript
 * const verification = await verifyTransaction("12345");
 *
 * if (verification.status === "success" && verification.data?.status === "successful") {
 *   // Payment was successful - update database
 *   await updateTransactionStatus(verification.data.tx_ref, "COMPLETED");
 * } else {
 *   // Payment failed - handle accordingly
 *   console.error("Payment verification failed");
 * }
 * ```
 */
export async function verifyTransaction(
  transactionId: string | number,
): Promise<TransactionVerificationResponse> {
  try {
    const response = await fetch(
      `${flutterwaveConfig.baseUrl}/transactions/${transactionId}/verify`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${flutterwaveConfig.secretKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        status: "error",
        message: result.message || "Failed to verify transaction",
      };
    }

    return {
      status: "success",
      message: "Transaction verified successfully",
      data: result.data,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred",
    };
  }
}

/**
 * Verify webhook signature from Flutterwave
 *
 * This function verifies that a webhook request actually came from Flutterwave
 * by validating the signature in the request headers using constant-time comparison
 * to prevent timing attacks. Always verify webhook signatures before processing
 * webhook events to prevent fraudulent requests.
 *
 * @param signature - The webhook signature from request headers (verif-hash)
 * @returns True if the signature is valid, false otherwise
 *
 * @example
 * ```typescript
 * // In your webhook handler
 * app.post("/webhooks/flutterwave", (req, res) => {
 *   const signature = req.headers["verif-hash"];
 *
 *   if (!verifyWebhookSignature(signature as string)) {
 *     return res.status(401).json({ error: "Invalid signature" });
 *   }
 *
 *   // Process webhook event
 *   const event: FlutterwaveWebhookEvent = req.body;
 *   await handleWebhookEvent(event);
 *
 *   res.status(200).json({ status: "ok" });
 * });
 * ```
 */
export function verifyWebhookSignature(signature: string): boolean {
  const expectedSignature = flutterwaveConfig.webhookSecret;
  
  // Use constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Process a webhook event from Flutterwave
 *
 * This is a helper function that combines signature verification and event
 * processing. It ensures the webhook is authentic before processing the event.
 *
 * @param signature - The webhook signature from request headers
 * @param event - The webhook event data
 * @param handler - Callback function to handle verified events
 * @returns True if the event was processed, false if signature verification failed
 *
 * @example
 * ```typescript
 * app.post("/webhooks/flutterwave", async (req, res) => {
 *   const signature = req.headers["verif-hash"] as string;
 *   const event: FlutterwaveWebhookEvent = req.body;
 *
 *   const processed = await processWebhookEvent(signature, event, async (data) => {
 *     if (data.event === "charge.completed" && data.data.status === "successful") {
 *       // Update your database
 *       await updatePaymentStatus(data.data.tx_ref, "COMPLETED", data.data.flw_ref);
 *     }
 *   });
 *
 *   if (!processed) {
 *     return res.status(401).json({ error: "Invalid signature" });
 *   }
 *
 *   res.status(200).json({ status: "ok" });
 * });
 * ```
 */
export async function processWebhookEvent(
  signature: string,
  event: FlutterwaveWebhookEvent,
  handler: (event: FlutterwaveWebhookEvent) => Promise<void>,
): Promise<boolean> {
  if (!verifyWebhookSignature(signature)) {
    return false;
  }

  try {
    await handler(event);
    return true;
  } catch (error) {
    logger.error(error, "Error processing webhook event");
    throw error;
  }
}

/**
 * Generate a unique transaction reference
 *
 * This utility function generates a unique transaction reference that can be
 * used when initializing payments. The reference is guaranteed to be unique
 * for each call.
 *
 * @param prefix - Optional prefix for the transaction reference (default: "TXN")
 * @returns A unique transaction reference string
 *
 * @example
 * ```typescript
 * const txRef = generateTransactionReference("DONATION");
 * // Returns something like: "DONATION-1699564832123-a1b2c3d4"
 *
 * const txRef2 = generateTransactionReference();
 * // Returns something like: "TXN-1699564832456-e5f6g7h8"
 * ```
 */
export function generateTransactionReference(prefix = "TXN"): string {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(4).toString("hex");
  return `${prefix}-${timestamp}-${randomString}`;
}

/**
 * Validate transaction amount
 *
 * This utility ensures that transaction amounts meet minimum requirements
 * and are properly formatted.
 *
 * @param amount - The amount to validate
 * @param currency - The currency code
 * @returns An object with validation result and error message if invalid
 *
 * @example
 * ```typescript
 * const validation = validateTransactionAmount(100, "NGN");
 * if (!validation.isValid) {
 *   console.error(validation.error);
 *   // "Amount must be at least 1 NGN"
 * }
 * ```
 */
export function validateTransactionAmount(
  amount: number,
  currency: string,
): { isValid: boolean; error?: string } {
  if (!amount || amount <= 0) {
    return {
      isValid: false,
      error: "Amount must be greater than zero",
    };
  }

  // Minimum amounts per currency (in minor units)
  const minimumAmounts: Record<string, number> = {
    NGN: 1,
    USD: 1,
    GHS: 1,
    KES: 1,
    ZAR: 1,
  };

  const minAmount = minimumAmounts[currency.toUpperCase()] || 1;

  if (amount < minAmount) {
    return {
      isValid: false,
      error: `Amount must be at least ${minAmount} ${currency}`,
    };
  }

  return { isValid: true };
}
