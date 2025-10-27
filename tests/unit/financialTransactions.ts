import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateTransactionReference,
  validateTransactionAmount,
  verifyWebhookSignature,
} from "@/shared/utils/financialTransactions";

describe("Financial Transactions Utilities", () => {
  describe("generateTransactionReference", () => {
    it("should generate a transaction reference with default prefix", () => {
      const txRef = generateTransactionReference();
      expect(txRef).toMatch(/^TXN-\d+-[a-f0-9]{8}$/);
    });

    it("should generate a transaction reference with custom prefix", () => {
      const txRef = generateTransactionReference("DONATION");
      expect(txRef).toMatch(/^DONATION-\d+-[a-f0-9]{8}$/);
    });

    it("should generate unique references on subsequent calls", () => {
      const txRef1 = generateTransactionReference();
      const txRef2 = generateTransactionReference();
      expect(txRef1).not.toBe(txRef2);
    });
  });

  describe("validateTransactionAmount", () => {
    it("should validate a valid amount", () => {
      const result = validateTransactionAmount(1000, "NGN");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject zero amount", () => {
      const result = validateTransactionAmount(0, "NGN");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Amount must be greater than zero");
    });

    it("should reject negative amount", () => {
      const result = validateTransactionAmount(-100, "NGN");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Amount must be greater than zero");
    });

    it("should validate minimum amount for different currencies", () => {
      const usdResult = validateTransactionAmount(1, "USD");
      expect(usdResult.isValid).toBe(true);

      const ghsResult = validateTransactionAmount(1, "GHS");
      expect(ghsResult.isValid).toBe(true);

      const kesResult = validateTransactionAmount(1, "KES");
      expect(kesResult.isValid).toBe(true);
    });

    it("should reject amounts below minimum for currency", () => {
      const result = validateTransactionAmount(0.5, "NGN");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Amount must be at least");
    });
  });

  describe("verifyWebhookSignature", () => {
    beforeEach(() => {
      // Mock the flutterwaveConfig
      vi.resetModules();
    });

    it("should return true for valid signature", () => {
      // This test will use the actual config from env
      // In a real scenario, the signature would match the webhook secret
      const signature = "test_flw_webhook_secret";
      const result = verifyWebhookSignature(signature);
      expect(result).toBe(true);
    });

    it("should return false for invalid signature", () => {
      const signature = "invalid_signature";
      const result = verifyWebhookSignature(signature);
      expect(result).toBe(false);
    });

    it("should return false for empty signature", () => {
      const signature = "";
      const result = verifyWebhookSignature(signature);
      expect(result).toBe(false);
    });
  });
});
