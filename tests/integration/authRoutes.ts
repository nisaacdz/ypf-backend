import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createTestApp } from "../app";
import type { Express } from "express";
import { hashSync } from "bcryptjs";
import pgPool from "@/configs/db";
import schema from "@/db/schema";

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
      const cookieHeader = response.headers["set-cookie"][0];
      expect(cookieHeader).toMatch(/auth_token=.+/);
      expect(cookieHeader).toMatch(/HttpOnly/);
      expect(cookieHeader).toMatch(/Path=\//);

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
      console.log(response.body.message);
    });

    it("should reject login with a non-existent email", async () => {
      const response = await request(app).post("/api/v1/auth/login").send({
        username: "nosuchuser@example.com",
        password: "anypassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.headers["set-cookie"]).toBeUndefined();
      console.log(response.body.message);
    });
  });
});
