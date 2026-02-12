import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import server from "@/configs/server";
import { hashSync } from "bcryptjs";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import logger from "@/configs/logger";
import { generateTestUser } from "../factories";

describe("Authentication API", () => {
  const testUser = generateTestUser();

  beforeAll(async () => {
    await dbClient.db
      .delete(schema.Users)
      .where(eq(schema.Users.email, testUser.email));

    const [newConstituent] = await dbClient.db
      .insert(schema.Constituents)
      .values({
        firstName: testUser.name.firstName,
        lastName: testUser.name.lastName,
      })
      .returning();

    testUser.constituentId = newConstituent.id;

    const hashedPassword = hashSync(testUser.password, 10);

    await dbClient.db.insert(schema.Users).values({
      email: testUser.email,
      password: hashedPassword,
      constituentId: testUser.constituentId,
      username: testUser.email,
    });
  });

  afterAll(async () => {
    if (testUser.constituentId) {
      await dbClient.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId));
    }
  });

  describe("POST /api/v1/auth/login", () => {
    it("should login with valid credentials and set an httpOnly cookie", async () => {
      const response = await request(server).post("/api/v1/auth/login").send({
        username: testUser.email,
        password: testUser.password,
      });

      expect(response.status).toBe(200);

      expect(response.headers["set-cookie"]).toBeDefined();

      // Should have access_token cookie
      const setCookieHeader = response.headers["set-cookie"];
      const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

      const accessTokenCookie = cookies.find((c) => c.includes("access_token"));

      expect(accessTokenCookie).toBeDefined();
      expect(accessTokenCookie).toMatch(/access_token=.+/);
      expect(accessTokenCookie).toMatch(/HttpOnly/);
      expect(accessTokenCookie).toMatch(/Path=\//);

      expect(response.body).not.toHaveProperty("token");
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      // AuthData now has YPFConstituentDetail at root, auth is nested
      expect(response.body.data).toHaveProperty("auth");
      expect(response.body.data.auth.email).toBe(testUser.email);
    });

    it("should reject login with wrong password", async () => {
      const response = await request(server).post("/api/v1/auth/login").send({
        username: testUser.email,
        password: "WrongPassword123!",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.headers["set-cookie"]).toBeUndefined();
      logger.info(response.body.message);
    });

    it("should reject login with a non-existent email", async () => {
      const response = await request(server).post("/api/v1/auth/login").send({
        username: "nosuchuser@example.com",
        password: "anypassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.headers["set-cookie"]).toBeUndefined();
      logger.info(response.body.message);
    });
  });

  describe("POST /api/v1/auth/forgot-password", () => {
    it("should send OTP email for existing user", async () => {
      const response = await request(server)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: testUser.email,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Password reset code sent");

      // Verify OTP was created in database
      const [otp] = await dbClient.db
        .select()
        .from(schema.Otps)
        .where(eq(schema.Otps.email, testUser.email));

      expect(otp).toBeDefined();
      expect(otp.code).toHaveLength(6);
      expect(otp.code).toMatch(/^\d{6}$/);

      // Verify expiration is set to 6 minutes from now (with some tolerance)
      const now = new Date();
      const expiresAt = new Date(otp.expiresAt);
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(5.5);
      expect(diffMinutes).toBeLessThan(6.5);
    });

    it("should reject forgot-password for non-existent user", async () => {
      const response = await request(server)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: "nonexistent@example.com",
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("should reject forgot-password with invalid email format", async () => {
      const response = await request(server)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: "invalid-email",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/auth/reset-password", () => {
    it("should reset password with valid OTP", async () => {
      // First, request a password reset to get an OTP
      await request(server).post("/api/v1/auth/forgot-password").send({
        email: testUser.email,
      });

      // Fetch the OTP from the database
      const [otpRecord] = await dbClient.db
        .select()
        .from(schema.Otps)
        .where(eq(schema.Otps.email, testUser.email));

      expect(otpRecord).toBeDefined();
      expect(otpRecord.code).toHaveLength(6);

      const newPassword = "NewSecurePassword123!";

      // Reset the password
      const response = await request(server)
        .post("/api/v1/auth/reset-password")
        .send({
          email: testUser.email,
          otp: otpRecord.code,
          password: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify OTP was marked as used
      const [usedOtp] = await dbClient.db
        .select()
        .from(schema.Otps)
        .where(eq(schema.Otps.id, otpRecord.id));

      expect(usedOtp.usedAt).not.toBeNull();

      // Verify the new password works
      const loginResponse = await request(server)
        .post("/api/v1/auth/login")
        .send({
          username: testUser.email,
          password: newPassword,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);

      // Update test user password for subsequent tests
      testUser.password = newPassword;
    });

    it("should reject password reset with invalid OTP", async () => {
      const response = await request(server)
        .post("/api/v1/auth/reset-password")
        .send({
          email: testUser.email,
          otp: "999999",
          password: "NewPassword123!",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid OTP");
    });

    it("should reject password reset with expired OTP", async () => {
      // Insert an expired OTP directly
      const expiredOtp = "123456";
      await dbClient.db.insert(schema.Otps).values({
        email: testUser.email,
        code: expiredOtp,
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      const response = await request(server)
        .post("/api/v1/auth/reset-password")
        .send({
          email: testUser.email,
          otp: expiredOtp,
          password: "NewPassword123!",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid OTP");

      // Clean up the expired OTP
      await dbClient.db
        .delete(schema.Otps)
        .where(eq(schema.Otps.code, expiredOtp));
    });

    it("should reject password reset with already used OTP", async () => {
      // Request a new OTP
      await request(server).post("/api/v1/auth/forgot-password").send({
        email: testUser.email,
      });

      // Fetch the OTP
      const [otpRecord] = await dbClient.db
        .select()
        .from(schema.Otps)
        .where(eq(schema.Otps.email, testUser.email));

      // Use the OTP once
      await request(server).post("/api/v1/auth/reset-password").send({
        email: testUser.email,
        otp: otpRecord.code,
        password: "AnotherPassword123!",
      });

      // Try to use the same OTP again
      const response = await request(server)
        .post("/api/v1/auth/reset-password")
        .send({
          email: testUser.email,
          otp: otpRecord.code,
          password: "YetAnotherPassword123!",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid OTP");

      // Update test user password
      testUser.password = "AnotherPassword123!";
    });

    it("should reject password reset with invalid email format", async () => {
      const response = await request(server)
        .post("/api/v1/auth/reset-password")
        .send({
          email: "invalid-email",
          otp: "123456",
          password: "NewPassword123!",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject password reset with non-existent user", async () => {
      const response = await request(server)
        .post("/api/v1/auth/reset-password")
        .send({
          email: "nonexistent@example.com",
          otp: "123456",
          password: "NewPassword123!",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid OTP");
    });

    it("should reject password reset with short password", async () => {
      const response = await request(server)
        .post("/api/v1/auth/reset-password")
        .send({
          email: testUser.email,
          otp: "123456",
          password: "abc",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject password reset with invalid OTP length", async () => {
      const response = await request(server)
        .post("/api/v1/auth/reset-password")
        .send({
          email: testUser.email,
          otp: "12345", // Too short
          password: "NewPassword123!",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should logout and clear cookies", async () => {
      const response = await request(server).post("/api/v1/auth/logout");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User successfully logged out");

      // Check that cookies are being cleared
      const setCookieHeader = response.headers["set-cookie"];
      expect(setCookieHeader).toBeDefined();

      const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

      // Should have access_token clear directive
      const accessTokenCookie = cookies.find((c) => c.includes("access_token"));

      expect(accessTokenCookie).toBeDefined();
      expect(accessTokenCookie).toMatch(/access_token=/);
      expect(accessTokenCookie).toMatch(/HttpOnly/);
      expect(accessTokenCookie).toMatch(/Path=\//);
    });

    it("should logout successfully even without existing cookies", async () => {
      const response = await request(server).post("/api/v1/auth/logout");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User successfully logged out");
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("should return user data when authenticated", async () => {
      // First login to get auth cookies
      const loginResponse = await request(server)
        .post("/api/v1/auth/login")
        .send({
          username: testUser.email,
          password: testUser.password,
        });

      const setCookieHeader = loginResponse.headers["set-cookie"];
      const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

      const accessToken = cookies.find((c) => c.includes("access_token"));

      const authCookie = accessToken?.split(";")[0] || "";

      // Call /auth/me with cookies
      const response = await request(server)
        .get("/api/v1/auth/me")
        .set("Cookie", authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).not.toBeNull();
      expect(response.body.data).toHaveProperty("id");
      // /auth/me returns AuthData (YPFConstituentDetail + { auth: AuthenticatedUser })
      expect(response.body.data.auth.email).toBe(testUser.email);
      expect(response.body.data).toHaveProperty("firstName");
      expect(response.body.data).toHaveProperty("profiles");
    });

    it("should return null when not authenticated", async () => {
      const response = await request(server).get("/api/v1/auth/me");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });

    it("should return null with invalid token", async () => {
      const response = await request(server)
        .get("/api/v1/auth/me")
        .set("Cookie", "access_token=invalid_token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });
  });

  describe("POST /api/v1/auth/onboard", () => {
    it("should send OTP email for existing user with no auth methods", async () => {
      // Create a user with no auth methods (password is null by default in schema if not set,
      // but generateTestUser might set it, so we need to explicitly create one without)

      const email = "noauth@example.com";

      // Clean up first
      await dbClient.db
        .delete(schema.Users)
        .where(eq(schema.Users.email, email));

      const [constituent] = await dbClient.db
        .insert(schema.Constituents)
        .values({
          firstName: "No",
          lastName: "Auth",
          email: email,
        })
        .returning();

      await dbClient.db.insert(schema.Users).values({
        email: email,
        constituentId: constituent.id,
        username: email,
        // password, googleId etc are null by default
      });

      const response = await request(server).post("/api/v1/auth/onboard").send({
        user: constituent.publicId,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain(
        "Onboarding verification code sent",
      );

      // Verify OTP was created
      const [otp] = await dbClient.db
        .select()
        .from(schema.Otps)
        .where(eq(schema.Otps.email, email));

      expect(otp).toBeDefined();
      expect(otp.code).toHaveLength(6);

      // Cleanup
      await dbClient.db
        .delete(schema.Users)
        .where(eq(schema.Users.email, email));
      await dbClient.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.email, email));
    });

    it("should reject onboard for non-existent user", async () => {
      const response = await request(server).post("/api/v1/auth/onboard").send({
        user: "YPF-2022-IU4C27",
      });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("should reject onboard with malformed user id", async () => {
      const response = await request(server).post("/api/v1/auth/onboard").send({
        user: "skdksdksdj232",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject onboard if user already has auth method (password)", async () => {
      // Use the testUser which has a password set
      // We need to fetch the publicId for the testUser first
      const [constituent] = await dbClient.db
        .select()
        .from(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId!));

      const response = await request(server).post("/api/v1/auth/onboard").send({
        user: constituent.publicId,
      });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain(
        "User already has an authentication method set",
      );
    });
  });
});
