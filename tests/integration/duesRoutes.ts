import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import request from "supertest";
import server from "@/configs/server";
import { hashSync } from "bcryptjs";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { generateTestUser, generateTestDues } from "../factories";
import { extractAccessTokenCookie } from "../helpers";

describe("Dues API", () => {
  let authTokenCookie: string;

  const testUser = generateTestUser();
  const testDues = generateTestDues();
  let testMemberId: string;

  beforeAll(async () => {
    // Clean up any existing test user
    await dbClient.db
      .delete(schema.Users)
      .where(eq(schema.Users.email, testUser.email));

    // Create constituent
    const [newConstituent] = await dbClient.db
      .insert(schema.Constituents)
      .values({
        firstName: testUser.name.firstName,
        lastName: testUser.name.lastName,
        email: testUser.email,
      })
      .returning();

    testUser.constituentId = newConstituent.id;

    // Create test user
    const hashedPassword = hashSync(testUser.password, 10);
    await dbClient.db.insert(schema.Users).values({
      email: testUser.email,
      password: hashedPassword,
      constituentId: testUser.constituentId,
      username: testUser.email,
    });

    // Create a member for testing (required for MEMBER profile)
    const [newMember] = await dbClient.db
      .insert(schema.Members)
      .values({
        constituentId: testUser.constituentId,
        startedAt: new Date(),
      })
      .returning();

    testMemberId = newMember.id;

    // Create test dues (global, chapterId = null)
    const [newDues] = await dbClient.db
      .insert(schema.Dues)
      .values({
        amount: testDues.amount,
        currency: testDues.currency,
        periodStart: testDues.periodStart,
        periodEnd: testDues.periodEnd,
        chapterId: null,
      })
      .returning();

    testDues.id = newDues.id;

    // Login to get auth token
    const loginResponse = await request(server)
      .post("/api/v1/auth/login")
      .send({
        username: testUser.email,
        password: testUser.password,
      });

    authTokenCookie = extractAccessTokenCookie(loginResponse.headers["set-cookie"]);
  });

  afterAll(async () => {
    // Clean up in reverse order of dependencies

    // Clean up dues payments and transactions
    if (testDues.id) {
      const duesPayments = await dbClient.db
        .select()
        .from(schema.DuesPayments)
        .where(eq(schema.DuesPayments.duesId, testDues.id));

      for (const payment of duesPayments) {
        await dbClient.db
          .delete(schema.DuesPayments)
          .where(eq(schema.DuesPayments.id, payment.id));

        await dbClient.db
          .delete(schema.FinancialTransactions)
          .where(eq(schema.FinancialTransactions.id, payment.transactionId));
      }

      // Clean up test dues
      await dbClient.db
        .delete(schema.Dues)
        .where(eq(schema.Dues.id, testDues.id));
    }

    // Clean up test user and constituent
    if (testUser.constituentId) {
      await dbClient.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId));
    }
  });

  describe("GET /api/v1/dues", () => {
    it("should get list of dues", async () => {
      const response = await request(server)
        .get("/api/v1/dues")
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("items");
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data).toHaveProperty("page");
      expect(response.body.data).toHaveProperty("pageSize");
      expect(response.body.data).toHaveProperty("total");
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(10);
    });

    it("should get list of dues with pagination parameters", async () => {
      const response = await request(server)
        .get("/api/v1/dues?page=1&pageSize=5")
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it("should include test dues in list", async () => {
      const response = await request(server)
        .get("/api/v1/dues")
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      const testDuesInList = response.body.data.items.find(
        (d: { id: string }) => d.id === testDues.id,
      );
      expect(testDuesInList).toBeDefined();
      expect(testDuesInList.amount).toBe(testDues.amount);
      expect(testDuesInList.currency).toBe(testDues.currency);
    });

    it("should reject request without session cookie", async () => {
      const response = await request(server).get("/api/v1/dues").expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should reject request with invalid page parameter", async () => {
      const response = await request(server)
        .get("/api/v1/dues?page=0")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should reject request with invalid pageSize parameter", async () => {
      const response = await request(server)
        .get("/api/v1/dues?pageSize=101")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });
  });

  describe("GET /api/v1/dues/:duesId/status", () => {
    it("should get dues status with initial values", async () => {
      const response = await request(server)
        .get(`/api/v1/dues/${testDues.id}/status`)
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("dues");
      expect(response.body.data.dues.id).toBe(testDues.id);
      expect(response.body.data.dues.amount).toBe(testDues.amount);
      expect(response.body.data).toHaveProperty("totalPaid");
      expect(response.body.data.totalPaid).toBe("0.00");
      expect(response.body.data).toHaveProperty("remainingBalance");
      expect(response.body.data.remainingBalance).toBe(testDues.amount);
      expect(response.body.data).toHaveProperty("isFullyPaid");
      expect(response.body.data.isFullyPaid).toBe(false);
      expect(response.body.data).toHaveProperty("payments");
      expect(Array.isArray(response.body.data.payments)).toBe(true);
    });

    it("should reject request without session cookie", async () => {
      const response = await request(server)
        .get(`/api/v1/dues/${testDues.id}/status`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should return 400 for invalid dues ID format", async () => {
      const response = await request(server)
        .get("/api/v1/dues/invalid-uuid/status")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 404 for non-existent dues ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await request(server)
        .get(`/api/v1/dues/${nonExistentId}/status`)
        .set("Cookie", authTokenCookie)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Dues not found");
    });
  });

  describe("GET /api/v1/dues/payments", () => {
    it("should get empty payment history for new member", async () => {
      const response = await request(server)
        .get("/api/v1/dues/payments")
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("items");
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data).toHaveProperty("page");
      expect(response.body.data).toHaveProperty("pageSize");
      expect(response.body.data).toHaveProperty("total");
    });

    it("should get payment history with pagination parameters", async () => {
      const response = await request(server)
        .get("/api/v1/dues/payments?page=1&pageSize=5")
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(5);
    });

    it("should reject request without session cookie", async () => {
      const response = await request(server)
        .get("/api/v1/dues/payments")
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/dues/pay", () => {
    it("should reject request without session cookie", async () => {
      const response = await request(server)
        .post("/api/v1/dues/pay")
        .send({
          duesId: testDues.id,
          amount: 50,
          currency: "GHS",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should reject request with invalid duesId format", async () => {
      const response = await request(server)
        .post("/api/v1/dues/pay")
        .set("Cookie", authTokenCookie)
        .send({
          duesId: "invalid-uuid",
          amount: 50,
          currency: "GHS",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject request with non-existent duesId", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await request(server)
        .post("/api/v1/dues/pay")
        .set("Cookie", authTokenCookie)
        .send({
          duesId: nonExistentId,
          amount: 50,
          currency: "GHS",
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Dues not found");
    });

    it("should reject request with negative amount", async () => {
      const response = await request(server)
        .post("/api/v1/dues/pay")
        .set("Cookie", authTokenCookie)
        .send({
          duesId: testDues.id,
          amount: -50,
          currency: "GHS",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject request with zero amount", async () => {
      const response = await request(server)
        .post("/api/v1/dues/pay")
        .set("Cookie", authTokenCookie)
        .send({
          duesId: testDues.id,
          amount: 0,
          currency: "GHS",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject request with amount exceeding remaining balance", async () => {
      const excessiveAmount = parseFloat(testDues.amount) + 100;
      const response = await request(server)
        .post("/api/v1/dues/pay")
        .set("Cookie", authTokenCookie)
        .send({
          duesId: testDues.id,
          amount: excessiveAmount,
          currency: "GHS",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("exceeds remaining balance");
    });

    it("should reject request with invalid currency format", async () => {
      const response = await request(server)
        .post("/api/v1/dues/pay")
        .set("Cookie", authTokenCookie)
        .send({
          duesId: testDues.id,
          amount: 50,
          currency: "INVALID",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    // Note: The following test would actually hit Paystack API
    // In a real scenario, you'd mock the Paystack API or skip this in CI
    // it("should initiate payment with valid data", async () => {
    //   const response = await request(server)
    //     .post("/api/v1/dues/pay")
    //     .set("Cookie", authTokenCookie)
    //     .send({
    //       duesId: testDues.id,
    //       amount: 50,
    //       currency: "GHS",
    //     })
    //     .expect(200);

    //   expect(response.body.success).toBe(true);
    //   expect(response.body.data).toHaveProperty("paymentId");
    //   expect(response.body.data).toHaveProperty("paymentUrl");
    //   expect(response.body.data.paymentUrl).toContain("paystack");
    // });
  });
});
