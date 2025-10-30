import { eq, and } from "drizzle-orm";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import variables from "@/configs/env";
import { AppError, AuthenticatedUser } from "@/shared/types";
import logger from "@/configs/logger";
import { findOrCreateConstituent } from "./donorMatchingService";
import { v4 as uuidv4 } from "uuid";

type CreateDonationInput = {
  amount: number;
  currency: string;
  anonymous?: boolean;
  donorInfo?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    salutation?: string;
  };
  projectId?: string;
  eventId?: string;
};

type DonationResponse = {
  id: string;
  amount: string;
  currency: string;
  donor?: {
    firstName: string;
    lastName: string;
    salutation?: string | null;
  };
};

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    channel: string;
    paid_at: string;
  };
};

/**
 * Creates a new donation and generates Paystack payment URL
 */
export async function createDonation(
  input: CreateDonationInput,
  user: AuthenticatedUser | null,
): Promise<{
  donation: DonationResponse;
  paymentUrl: string;
}> {
  const {
    amount,
    currency,
    anonymous = false,
    donorInfo,
    projectId,
    eventId,
  } = input;

  try {
    let constituentId: string | null = null;
    let constituentForResponse: {
      firstName: string;
      lastName: string;
      salutation: string | null;
    } | null = null;

    // Determine constituent based on authentication status and anonymous flag
    if (!anonymous) {
      if (user) {
        // Authenticated user donation
        constituentId = user.constituentId;

        // Fetch constituent details for response
        const constituent = await pgPool.db.query.Constituents.findFirst({
          where: eq(schema.Constituents.id, user.constituentId),
        });
        if (constituent) {
          constituentForResponse = {
            firstName: constituent.firstName,
            lastName: constituent.lastName,
            salutation: constituent.salutation,
          };
        }
      } else if (donorInfo) {
        // Guest donation - apply matching logic
        const matchResult = await findOrCreateConstituent(donorInfo, false);
        if (matchResult) {
          constituentId = matchResult.constituentId;

          // Fetch constituent details for response
          const constituent = await pgPool.db.query.Constituents.findFirst({
            where: eq(schema.Constituents.id, matchResult.constituentId),
          });
          if (constituent) {
            constituentForResponse = {
              firstName: constituent.firstName,
              lastName: constituent.lastName,
              salutation: constituent.salutation,
            };
          }
        }
      } else {
        throw new AppError(
          "Donor information is required for non-anonymous donations",
          400,
        );
      }
    }

    // Create financial transaction
    const [transaction] = await pgPool.db
      .insert(schema.FinancialTransactions)
      .values({
        amount: amount.toFixed(2),
        currency,
        status: "PENDING",
        externalProvider: "PAYSTACK",
      })
      .returning();

    // Create donation record
    const [donation] = await pgPool.db
      .insert(schema.Donations)
      .values({
        transactionId: transaction.id,
        constituentId,
        projectId: projectId || null,
        eventId: eventId || null,
      })
      .returning();

    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${variables.services.paystack.secretHash}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.floor(amount * 100), // Paystack expects amount in kobo/pesewas (use floor to avoid overcharging)
          currency,
          reference: uuidv4(),
          callback_url: `${variables.app.host}/donations/callback`,
        }),
      },
    );

    if (!paystackResponse.ok) {
      const errorData = await paystackResponse.json();
      logger.error("Paystack initialization failed:", errorData);
      throw new AppError("Failed to initialize payment", 500);
    }

    const paystackData: PaystackInitializeResponse =
      await paystackResponse.json();

    if (!paystackData.status) {
      throw new AppError(
        paystackData.message || "Failed to initialize payment",
        500,
      );
    }

    // Update transaction with Paystack reference
    await pgPool.db
      .update(schema.FinancialTransactions)
      .set({ externalRef: paystackData.data.reference })
      .where(eq(schema.FinancialTransactions.id, transaction.id));

    // Build response
    const donationResponse: DonationResponse = {
      id: donation.id,
      amount: transaction.amount,
      currency: transaction.currency,
    };

    if (constituentForResponse && !anonymous) {
      donationResponse.donor = {
        firstName: constituentForResponse.firstName,
        lastName: constituentForResponse.lastName,
        salutation: constituentForResponse.salutation,
      };
    }

    logger.info(
      `Created donation ${donation.id} with Paystack reference ${paystackData.data.reference}`,
    );

    return {
      donation: donationResponse,
      paymentUrl: paystackData.data.authorization_url,
    };
  } catch (error) {
    logger.error({ error }, "Error creating donation");
    throw error;
  }
}

/**
 * Verifies a donation using Paystack's verification API
 */
export async function verifyDonation(donationId: string): Promise<{
  status: string;
}> {
  try {
    // Fetch donation with transaction
    const donation = await pgPool.db.query.Donations.findFirst({
      where: eq(schema.Donations.id, donationId),
      with: {
        transaction: true,
      },
    });

    if (!donation) {
      throw new AppError("Donation not found", 404);
    }

    if (!donation.transaction) {
      throw new AppError("Transaction not found for this donation", 404);
    }

    // Verify it's a Paystack transaction
    if (donation.transaction.externalProvider !== "PAYSTACK") {
      throw new AppError(
        "Only Paystack donations can be verified through this endpoint",
        400,
      );
    }

    if (!donation.transaction.externalRef) {
      throw new AppError(
        "No external reference found for this transaction",
        400,
      );
    }

    // Call Paystack verification API
    const paystackSecretKey = variables.services.paystack.secretHash;
    if (!paystackSecretKey) {
      throw new AppError("Paystack configuration is missing", 500);
    }

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${donation.transaction.externalRef}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      },
    );

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      logger.error("Paystack verification failed:", errorData);
      throw new AppError("Failed to verify payment", 500);
    }

    const verifyData: PaystackVerifyResponse = await verifyResponse.json();

    if (!verifyData.status) {
      throw new AppError(verifyData.message || "Failed to verify payment", 500);
    }

    // Map Paystack status to our status
    const statusMap: Record<
      string,
      (typeof schema.TransactionStatus.enumValues)[number]
    > = {
      success: "COMPLETED",
      failed: "FAILED",
      abandoned: "FAILED",
    };

    const newStatus = statusMap[verifyData.data.status] || "PENDING";

    // Map Paystack channel to our payment method
    const paymentMethodMap: Record<
      string,
      (typeof schema.PaymentMethod.enumValues)[number]
    > = {
      card: "CREDIT_CARD",
      bank: "BANK_TRANSFER",
      bank_transfer: "BANK_TRANSFER",
      mobile_money: "MOBILE_MONEY",
    };

    const paymentMethod =
      paymentMethodMap[verifyData.data.channel] || "CREDIT_CARD";

    // Update transaction status only if still pending
    const updateResult = await pgPool.db
      .update(schema.FinancialTransactions)
      .set({
        status: newStatus,
        paymentMethod,
      })
      .where(
        and(
          eq(schema.FinancialTransactions.id, donation.transaction.id),
          eq(schema.FinancialTransactions.status, "PENDING"),
        ),
      )
      .returning({ id: schema.FinancialTransactions.id });

    // Check if update was successful
    if (updateResult.length === 0) {
      logger.warn(
        `Transaction ${donation.transaction.id} was not updated - may have been processed already`,
      );
      // Return current status from database instead of from Paystack
      return {
        status: donation.transaction.status,
      };
    }

    logger.info(`Verified donation ${donationId} with status: ${newStatus}`);

    return {
      status: newStatus,
    };
  } catch (error) {
    logger.error({ error }, "Error verifying donation");
    throw error;
  }
}

/**
 * Checks if a donation has been completed
 */
export async function checkDonationStatus(donationId: string): Promise<{
  completed: boolean;
  status: string;
  updatedAt: Date;
}> {
  try {
    const donation = await pgPool.db.query.Donations.findFirst({
      where: eq(schema.Donations.id, donationId),
      with: {
        transaction: true,
      },
    });

    if (!donation) {
      throw new AppError("Donation not found", 404);
    }

    if (!donation.transaction) {
      throw new AppError("Transaction not found for this donation", 404);
    }

    return {
      completed: donation.transaction.status === "COMPLETED",
      status: donation.transaction.status,
      updatedAt: donation.transaction.transactionDate,
    };
  } catch (error) {
    logger.error({ error }, "Error checking donation status");
    throw error;
  }
}
