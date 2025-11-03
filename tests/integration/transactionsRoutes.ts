import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createTestApp } from "../app";
import type { Express } from "express";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { v4 as uuidv4 } from "uuid";
import * as paymentsService from "@/shared/services/paymentsService";

describe("Transactions API", () => {
  let app: Express;
  let testTransactionRef: string;
  let testTransactionId: string;
  let testDonationId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Create a test transaction with a donation
    testTransactionRef = uuidv4();

    const [newTransaction] = await pgPool.db
      .insert(schema.FinancialTransactions)
      .values({
        amount: "100.00",
        currency: "GHS",
        status: "PENDING",
        externalProvider: "PAYSTACK",
        externalRef: testTransactionRef,
      })
      .returning();

    testTransactionId = newTransaction.id;

    const [newDonation] = await pgPool.db
      .insert(schema.Donations)
      .values({
        transactionId: testTransactionId,
        guestName: "Test Donor",
        guestEmail: "test@example.com",
      })
      .returning();

    testDonationId = newDonation.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testDonationId) {
      await pgPool.db
        .delete(schema.Donations)
        .where(eq(schema.Donations.id, testDonationId));
    }
    if (testTransactionId) {
      await pgPool.db
        .delete(schema.FinancialTransactions)
        .where(eq(schema.FinancialTransactions.id, testTransactionId));
    }
  });

  describe("POST /api/v1/transactions/:reference/verify", () => {
    it("should return 404 for non-existent transaction", async () => {
      const nonExistentRef = uuidv4();

      const response = await request(app)
        .post(`/api/v1/transactions/${nonExistentRef}/verify`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it("should verify a pending transaction (mocked)", async () => {
      // Mock the Paystack API call
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: "Verification successful",
          data: {
            status: "success",
            reference: testTransactionRef,
            amount: 10000,
            currency: "GHS",
            channel: "card",
            paid_at: new Date().toISOString(),
          },
        }),
      });

      global.fetch = mockFetch as unknown as typeof fetch;

      const response = await request(app)
        .post(`/api/v1/transactions/${testTransactionRef}/verify`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Transaction verified successfully");
      expect(response.body.data).toHaveProperty("status");
      
      // Verify the transaction was updated in the database
      const [updatedTransaction] = await pgPool.db
        .select()
        .from(schema.FinancialTransactions)
        .where(eq(schema.FinancialTransactions.id, testTransactionId))
        .limit(1);

      expect(updatedTransaction.status).toBe("COMPLETED");

      // Restore fetch
      vi.restoreAllMocks();
    });

    it("should not update already completed transaction (race condition test)", async () => {
      // The transaction should already be COMPLETED from the previous test
      
      // Mock the Paystack API call again
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: "Verification successful",
          data: {
            status: "success",
            reference: testTransactionRef,
            amount: 10000,
            currency: "GHS",
            channel: "card",
            paid_at: new Date().toISOString(),
          },
        }),
      });

      global.fetch = mockFetch as unknown as typeof fetch;

      const response = await request(app)
        .post(`/api/v1/transactions/${testTransactionRef}/verify`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("COMPLETED");

      // Verify the mock was NOT called since transaction was already completed
      // The function should return early without calling Paystack
      expect(mockFetch).not.toHaveBeenCalled();

      // Restore fetch
      vi.restoreAllMocks();
    });
  });

  describe("Race condition protection in verifyPaystackTransaction", () => {
    it("should handle concurrent verification attempts", async () => {
      // Create a new pending transaction for this test
      const newRef = uuidv4();
      const [newTransaction] = await pgPool.db
        .insert(schema.FinancialTransactions)
        .values({
          amount: "50.00",
          currency: "GHS",
          status: "PENDING",
          externalProvider: "PAYSTACK",
          externalRef: newRef,
        })
        .returning();

      const [newDonation] = await pgPool.db
        .insert(schema.Donations)
        .values({
          transactionId: newTransaction.id,
          guestName: "Race Test Donor",
          guestEmail: "race@example.com",
        })
        .returning();

      // Mock Paystack API
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          data: {
            status: "success",
            reference: newRef,
            amount: 5000,
            currency: "GHS",
            channel: "card",
            paid_at: new Date().toISOString(),
          },
        }),
      });

      global.fetch = mockFetch as unknown as typeof fetch;

      // Simulate concurrent verification attempts
      const results = await Promise.all([
        paymentsService.verifyPaystackTransaction(newRef),
        paymentsService.verifyPaystackTransaction(newRef),
        paymentsService.verifyPaystackTransaction(newRef),
      ]);

      // Only one should report wasUpdated = true
      const updatedCount = results.filter((r) => r.wasUpdated).length;
      expect(updatedCount).toBe(1);

      // All should have the same final status
      expect(results.every((r) => r.status === "COMPLETED")).toBe(true);

      // Clean up
      await pgPool.db
        .delete(schema.Donations)
        .where(eq(schema.Donations.id, newDonation.id));
      await pgPool.db
        .delete(schema.FinancialTransactions)
        .where(eq(schema.FinancialTransactions.id, newTransaction.id));

      vi.restoreAllMocks();
    });
  });
});
