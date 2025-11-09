import { and, eq, not, desc } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError } from "@/shared/types";
import logger from "@/configs/logger";
import { transactionStatusMap, paymentMethodMap } from "../utils";
import {
  sendDonationAcknowledgementEmail,
  sendDuesPaymentAcknowledgementEmail,
  sendOrderConfirmationEmail,
  sendTransactionFailureEmail,
  sendTransactionRefundEmail,
} from "@/shared/utils/email";
import { getPaymentProvider, TransactionStatus } from "./paymentProviders";

export type PaystackWebhookPayload = {
  event: "charge.success" | "charge.failed";
  data: {
    status: string;
    reference: string;
    channel: string;
    amount: string;
    currency: string;
  };
};

export async function handlePaystackWebhook(
  payload: PaystackWebhookPayload,
): Promise<{
  transactionId?: string;
  wasUpdated: boolean;
}> {
  const { data } = payload;

  const { reference, status, channel, amount, currency } = data;

  const newStatus = transactionStatusMap[status];
  const newPaymentMethod = paymentMethodMap[channel];

  type TransactionStatus =
    (typeof schema.TransactionStatusEnum.enumValues)[number];
  type PaymentMethod = (typeof schema.PaymentMethodEnum.enumValues)[number];

  const result = await dbClient.db
    .update(schema.FinancialTransactions)
    .set({
      status: newStatus as TransactionStatus,
      paymentMethod: newPaymentMethod as PaymentMethod,
      amount,
      currency,
    })
    .where(
      and(
        eq(schema.FinancialTransactions.externalProvider, "PAYSTACK"),
        eq(schema.FinancialTransactions.externalRef, reference),
        not(
          eq(
            schema.FinancialTransactions.status,
            newStatus as TransactionStatus,
          ),
        ),
      ),
    )
    .returning();

  let wasUpdated: boolean;
  let transactionId: string | undefined;

  if (result.length > 0) {
    logger.info(
      `Successfully updated transaction ${result[0].id} to ${newStatus}.`,
    );
    wasUpdated = true;
    transactionId = result[0].id;

    // If transaction is completed, update order status if applicable
    if (newStatus === "COMPLETED") {
      await updateOrderStatusOnPayment(result[0].id);
    }
  } else {
    // This can happen if the webhook is sent twice, or if the transaction wasn't found.
    // It's not an error, just a state to be aware of.
    logger.warn(
      `No pending transaction found for Paystack reference: ${reference}. It might have been already processed.`,
    );
    wasUpdated = false;
  }

  return { wasUpdated, transactionId };
}

/**
 * Generic transaction verification function that routes to the appropriate
 * provider-specific verification based on the transaction's external provider.
 * This is the main entry point for the /verify endpoint.
 */
export async function verifyTransaction(reference: string): Promise<{
  transactionId: string;
  status: TransactionStatus;
  wasUpdated: boolean;
}> {
  // First, look up the transaction to determine the provider
  const [transaction] = await dbClient.db
    .select()
    .from(schema.FinancialTransactions)
    .where(eq(schema.FinancialTransactions.externalRef, reference))
    .limit(1);

  if (!transaction) {
    throw new ApiError("Transaction not found", 404);
  }

  // Route to the appropriate provider-specific verification function
  switch (transaction.externalProvider) {
    case "PAYSTACK":
      return await verifyPaystackTransaction(reference);
    // Future providers can be added here:
    // case "STRIPE":
    //   return await verifyStripeTransaction(reference);
    // case "FLUTTERWAVE":
    //   return await verifyFlutterwaveTransaction(reference);
    default:
      throw new ApiError(
        `Unsupported payment provider: ${transaction.externalProvider}`,
        400,
      );
  }
}

/**
 * Verifies a Paystack transaction using the payment provider's verification API.
 * This function uses the payment provider abstraction to support multiple gateways.
 *
 * Race condition protection: Only updates transactions that are still PENDING.
 */
export async function verifyPaystackTransaction(reference: string): Promise<{
  transactionId: string;
  status: TransactionStatus;
  wasUpdated: boolean;
}> {
  try {
    // Fetch transaction by reference
    const [transaction] = await dbClient.db
      .select()
      .from(schema.FinancialTransactions)
      .where(
        and(
          eq(schema.FinancialTransactions.externalProvider, "PAYSTACK"),
          eq(schema.FinancialTransactions.externalRef, reference),
        ),
      )
      .limit(1);

    if (!transaction) {
      throw new ApiError("Transaction not found", 404);
    }

    // Race condition check: If already successful, don't process again
    if (transaction.status === "COMPLETED") {
      logger.info(
        `Transaction ${transaction.id} already completed. Skipping verification.`,
      );
      return {
        transactionId: transaction.id,
        status: "COMPLETED",
        wasUpdated: false,
      };
    }

    // Get payment provider and verify transaction
    const provider = getPaymentProvider(transaction.externalProvider);
    if (!provider) {
      throw new ApiError(
        `Unsupported payment provider: ${transaction.externalProvider}`,
        500,
      );
    }

    // Call provider's verification API
    const verifyResult = await provider.verifyTransaction(reference);

    // Map provider status to our internal status
    const newStatus = provider.mapStatus(verifyResult.status);
    const paymentMethod = provider.mapPaymentMethod(verifyResult.channel);

    type TransactionStatus =
      (typeof schema.TransactionStatusEnum.enumValues)[number];
    type PaymentMethod = (typeof schema.PaymentMethodEnum.enumValues)[number];

    // Update transaction status only if still pending (race condition protection)
    const updateResult = await dbClient.db
      .update(schema.FinancialTransactions)
      .set({
        status: newStatus as TransactionStatus,
        paymentMethod: paymentMethod as PaymentMethod,
      })
      .where(
        and(
          eq(schema.FinancialTransactions.id, transaction.id),
          eq(schema.FinancialTransactions.status, "PENDING"),
        ),
      )
      .returning({ id: schema.FinancialTransactions.id });

    // Check if update was successful
    const wasUpdated = updateResult.length > 0;

    if (!wasUpdated) {
      logger.warn(
        `Transaction ${transaction.id} was not updated - may have been processed already`,
      );
      // Return current status from database
      return {
        transactionId: transaction.id,
        status: transaction.status,
        wasUpdated: false,
      };
    }

    logger.info(
      `Verified transaction ${transaction.id} with status: ${newStatus}`,
    );

    // If transaction is for an order and was completed, update order status
    if (newStatus === "COMPLETED" && wasUpdated) {
      await updateOrderStatusOnPayment(transaction.id);
    }

    return {
      transactionId: transaction.id,
      status: newStatus,
      wasUpdated: true,
    };
  } catch (error) {
    logger.error({ error }, "Error verifying transaction");
    throw error;
  }
}

/**
 * Updates order status when payment is completed.
 * Called after a transaction status is updated to COMPLETED.
 */
async function updateOrderStatusOnPayment(
  transactionId: string,
): Promise<void> {
  try {
    // Find the order payment record
    const [orderPayment] = await dbClient.db
      .select()
      .from(schema.OrderPayments)
      .where(eq(schema.OrderPayments.transactionId, transactionId))
      .limit(1);

    if (orderPayment) {
      // Update the order status to COMPLETED
      await dbClient.db
        .update(schema.Orders)
        .set({ status: "COMPLETED" })
        .where(
          and(
            eq(schema.Orders.id, orderPayment.orderId),
            eq(schema.Orders.status, "PENDING"),
          ),
        );

      logger.info(`Updated order ${orderPayment.orderId} to COMPLETED`);
    }
  } catch (error) {
    logger.error({ error }, "Error updating order status");
    // Don't throw - order status update failure shouldn't break payment flow
  }
}

/**
 * Helper function to get the primary email address for a constituent.
 * Queries the contact_informations table, filters by EMAIL type,
 * and prioritizes primary emails.
 */
async function getConstituentEmail(
  constituentId: string,
): Promise<string | null> {
  const contactInfos = await dbClient.db
    .select()
    .from(schema.ContactInformations)
    .where(
      and(
        eq(schema.ContactInformations.constituentId, constituentId),
        eq(schema.ContactInformations.contactType, "EMAIL"),
      ),
    )
    .orderBy(desc(schema.ContactInformations.isPrimary));

  if (contactInfos.length > 0) {
    return contactInfos[0].value;
  }
  return null;
}

/**
 * Sends a transaction success email based on the transaction type.
 * This function determines the entity type (donation, shop order, etc.)
 * and sends the appropriate email template.
 */
export async function sendTransactionSuccessEmail(
  transactionId: string,
): Promise<void> {
  try {
    // Fetch transaction with related entities
    const transaction = await dbClient.db.query.FinancialTransactions.findFirst(
      {
        where: and(
          eq(schema.FinancialTransactions.id, transactionId),
          eq(schema.FinancialTransactions.status, "COMPLETED"),
        ),
        with: {
          donation: {
            with: {
              constituent: true,
            },
          },
          duesPayment: {
            with: {
              member: {
                with: {
                  constituent: true,
                },
              },
              dues: true,
            },
          },
          ordersPayment: {
            with: {
              order: {
                with: {
                  constituent: true,
                },
              },
            },
          },
        },
      },
    );

    if (!transaction) {
      logger.warn(
        `Transaction ${transactionId} not found for email notification`,
      );
      return;
    }

    // Check if this is a donation
    if (transaction.donation) {
      const donation = transaction.donation;

      // Determine recipient email and name
      let email: string | null = null;
      let name: string | null = null;

      if (donation.guestEmail && donation.guestName) {
        // Guest donation with email
        email = donation.guestEmail;
        name = donation.guestName;
      } else if (donation.constituent) {
        // Registered user donation - use contact_informations table
        email = await getConstituentEmail(donation.constituent.id);
        name = `${donation.constituent.firstName} ${donation.constituent.lastName}`;
      }

      // Send email if we have both email and name
      if (email && name) {
        await sendDonationAcknowledgementEmail({
          email,
          name,
          donation: {
            id: donation.id,
            amount: transaction.amount,
            currency: transaction.currency,
          },
        });
        logger.info(
          `Sent donation acknowledgement email for transaction ${transactionId}`,
        );
      } else {
        logger.info(
          `Skipping email for anonymous or incomplete donation ${donation.id}`,
        );
      }
    } else if (transaction.duesPayment) {
      const duesPayment = transaction.duesPayment;
      const member = duesPayment.member;
      const dues = duesPayment.dues;

      if (member?.constituent) {
        const email = await getConstituentEmail(member.constituent.id);
        const name = `${member.constituent.firstName} ${member.constituent.lastName}`;

        if (email) {
          // Format the period for display
          // Dates are stored as string in the schema (date type without mode)
          const period = `${dues.periodStart} - ${dues.periodEnd}`;

          await sendDuesPaymentAcknowledgementEmail({
            email,
            name,
            payment: {
              id: duesPayment.id,
              amount: transaction.amount,
              currency: transaction.currency,
              period,
            },
          });
          logger.info(
            `Sent dues payment acknowledgement email for transaction ${transactionId}`,
          );
        } else {
          logger.warn(
            `No email found for constituent ${member.constituent.id} for dues payment ${duesPayment.id}`,
          );
        }
      }
    } else if (transaction.ordersPayment) {
      const ordersPayment = transaction.ordersPayment;
      const order = ordersPayment.order;

      if (order?.constituent) {
        const email = await getConstituentEmail(order.constituent.id);
        const name = `${order.constituent.firstName} ${order.constituent.lastName}`;

        if (email) {
          await sendOrderConfirmationEmail({
            email,
            name,
            order: {
              id: order.id,
              amount: transaction.amount,
              currency: transaction.currency,
            },
          });
          logger.info(
            `Sent order confirmation email for transaction ${transactionId}`,
          );
        } else {
          logger.warn(
            `No email found for constituent ${order.constituent.id} for order ${order.id}`,
          );
        }
      }
    }
  } catch (error) {
    logger.error(
      { error },
      `Error sending transaction success email for ${transactionId}`,
    );
    // Don't throw - email failure shouldn't break the payment flow
  }
}

/**
 * Sends an email notification when a transaction status changes.
 * This is typically called by webhook handlers when the payment provider
 * sends status updates (success, failure, refund).
 */
export async function sendTransactionStatusChangeEmail(
  transactionId: string,
): Promise<void> {
  try {
    // Fetch transaction with related entities
    const transaction = await dbClient.db.query.FinancialTransactions.findFirst(
      {
        where: eq(schema.FinancialTransactions.id, transactionId),
        with: {
          donation: {
            with: {
              constituent: true,
            },
          },
          duesPayment: {
            with: {
              member: {
                with: {
                  constituent: true,
                },
              },
              dues: true,
            },
          },
          ordersPayment: {
            with: {
              order: {
                with: {
                  constituent: true,
                },
              },
            },
          },
        },
      },
    );

    if (!transaction) {
      logger.warn(
        `Transaction ${transactionId} not found for status change email`,
      );
      return;
    }

    // Determine transaction type for email content
    let transactionType = "transaction";
    if (transaction.donation) {
      transactionType = "donation";
    } else if (transaction.duesPayment) {
      transactionType = "dues payment";
    } else if (transaction.ordersPayment) {
      transactionType = "order";
    }

    // Get recipient details based on transaction type
    let email: string | null = null;
    let name: string | null = null;

    if (transaction.donation) {
      const donation = transaction.donation;
      if (donation.guestEmail && donation.guestName) {
        email = donation.guestEmail;
        name = donation.guestName;
      } else if (donation.constituent) {
        email = await getConstituentEmail(donation.constituent.id);
        name = `${donation.constituent.firstName} ${donation.constituent.lastName}`;
      }
    } else if (transaction.duesPayment) {
      const member = transaction.duesPayment.member;
      if (member?.constituent) {
        email = await getConstituentEmail(member.constituent.id);
        name = `${member.constituent.firstName} ${member.constituent.lastName}`;
      }
    } else if (transaction.ordersPayment) {
      const order = transaction.ordersPayment.order;
      if (order?.constituent) {
        email = await getConstituentEmail(order.constituent.id);
        name = `${order.constituent.firstName} ${order.constituent.lastName}`;
      }
    }

    if (!email || !name) {
      logger.info(
        `No email/name found for transaction ${transactionId} status change notification`,
      );
      return;
    }

    const emailParams = {
      email,
      name,
      transaction: {
        id: transactionId,
        amount: transaction.amount,
        currency: transaction.currency,
        type: transactionType,
      },
    };

    // Send appropriate email based on new status
    if (transaction.status === "COMPLETED") {
      // If status changed to completed, send success email
      await sendTransactionSuccessEmail(transactionId);
    } else if (transaction.status === "FAILED") {
      await sendTransactionFailureEmail(emailParams);
      logger.info(
        `Sent transaction failure email for transaction ${transactionId}`,
      );
    } else if (transaction.status === "REFUNDED") {
      await sendTransactionRefundEmail(emailParams);
      logger.info(
        `Sent transaction refund email for transaction ${transactionId}`,
      );
    }
  } catch (error) {
    logger.error(
      { error },
      `Error sending transaction status change email for ${transactionId}`,
    );
    // Don't throw - email failure shouldn't break the webhook flow
  }
}
