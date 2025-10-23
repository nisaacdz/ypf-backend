import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createTestApp } from "../app";
import type { Express } from "express";
import { hashSync } from "bcryptjs";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import logger from "@/configs/logger";

describe("Authentication API", () => {
  let app: Express;
  const testUser = {
    email: "login-test@example.com",
    password: "SecurePassword123!",
    name: {
      firstName: "Login",
      lastName: "User",
    },
    constituentId: "",
  };

  beforeAll(async () => {
    app = await createTestApp();

    await pgPool.db
      .delete(schema.Users)
      .where(eq(schema.Users.email, testUser.email));

    const [newConstituent] = await pgPool.db
      .insert(schema.Constituents)
      .values({
        firstName: testUser.name.firstName,
        lastName: testUser.name.lastName,
      })
      .returning();

    testUser.constituentId = newConstituent.id;

    const hashedPassword = hashSync(testUser.password, 10);

    await pgPool.db.insert(schema.Users).values({
      email: testUser.email,
      password: hashedPassword,
      constituentId: testUser.constituentId,
      username: testUser.email,
    });
  });

  afterAll(async () => {
    if (testUser.constituentId) {
      await pgPool.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId));
    }
  });

  describe("POST /api/v1/auth/login", () => {
    it("should login with valid credentials and set an httpOnly cookie", async () => {
      const response = await request(app).post("/api/v1/auth/login").send({
        username: testUser.email,
        password: testUser.password,
      });

      expect(response.status).toBe(200);

      expect(response.headers["set-cookie"]).toBeDefined();

      // Should have both access_token and refresh_token cookies
      const setCookieHeader = response.headers["set-cookie"];
      const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];
      expect(cookies.length).toBeGreaterThanOrEqual(2);

      const accessTokenCookie = cookies.find((c) => c.includes("access_token"));
      const refreshTokenCookie = cookies.find((c) =>
        c.includes("refresh_token"),
      );

      expect(accessTokenCookie).toBeDefined();
      expect(accessTokenCookie).toMatch(/access_token=.+/);
      expect(accessTokenCookie).toMatch(/HttpOnly/);
      expect(accessTokenCookie).toMatch(/Path=\//);

      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toMatch(/refresh_token=.+/);
      expect(refreshTokenCookie).toMatch(/HttpOnly/);
      expect(refreshTokenCookie).toMatch(/Path=\//);

      expect(response.body).not.toHaveProperty("token");
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.email).toBe(testUser.email);
    });

    it("should reject login with wrong password", async () => {
      const response = await request(app).post("/api/v1/auth/login").send({
        username: testUser.email,
        password: "WrongPassword123!",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.headers["set-cookie"]).toBeUndefined();
      logger.info(response.body.message);
    });

    it("should reject login with a non-existent email", async () => {
      const response = await request(app).post("/api/v1/auth/login").send({
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
      const response = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: testUser.email,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Password reset code sent");

      // Verify OTP was created in database
      const [otp] = await pgPool.db
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
      const response = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: "nonexistent@example.com",
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("should reject forgot-password with invalid email format", async () => {
      const response = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({
          email: "invalid-email",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should logout and clear cookies", async () => {
      const response = await request(app).post("/api/v1/auth/logout");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User successfully logged out");

      // Check that cookies are being cleared
      const setCookieHeader = response.headers["set-cookie"];
      expect(setCookieHeader).toBeDefined();

      const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

      // Should have both access_token and refresh_token clear directives
      const accessTokenCookie = cookies.find((c) => c.includes("access_token"));
      const refreshTokenCookie = cookies.find((c) =>
        c.includes("refresh_token"),
      );

      expect(accessTokenCookie).toBeDefined();
      expect(accessTokenCookie).toMatch(/access_token=/);
      expect(accessTokenCookie).toMatch(/HttpOnly/);
      expect(accessTokenCookie).toMatch(/Path=\//);

      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toMatch(/refresh_token=/);
      expect(refreshTokenCookie).toMatch(/HttpOnly/);
      expect(refreshTokenCookie).toMatch(/Path=\//);
    });

    it("should logout successfully even without existing cookies", async () => {
      const response = await request(app).post("/api/v1/auth/logout");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User successfully logged out");
    });
  });
});
