import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createTestApp } from "../app";
import type { Express } from "express";
import { hashSync } from "bcryptjs";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { generateTestUser } from "../factories";

describe("Users API", () => {
  let app: Express;
  let authTokenCookie: string;

  const testUser = generateTestUser();

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

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: testUser.email,
      password: testUser.password,
    });

    const setCookieHeader = loginResponse.headers["set-cookie"];
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader];

    // Extract both access_token and refresh_token
    const accessToken = cookies.find((c) => c.includes("access_token"));
    const refreshToken = cookies.find((c) => c.includes("refresh_token"));

    authTokenCookie = [accessToken, refreshToken]
      .filter(Boolean)
      .map((c) => c?.split(";")[0])
      .join("; ");
  });

  afterAll(async () => {
    if (testUser.constituentId) {
      await pgPool.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId));
    }
  });

  describe("GET /api/v1/users/me", () => {
    it("should get the current user's profile with a valid session cookie", async () => {
      const response = await request(app)
        .get("/api/v1/users/me")
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.constituent).toHaveProperty(
        "firstName",
        testUser.name.firstName,
      );
      expect(response.body.data.constituent).toHaveProperty(
        "lastName",
        testUser.name.lastName,
      );
    });

    it("should reject the request if the session cookie is not provided", async () => {
      const response = await request(app).get("/api/v1/users/me").expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });
  });
});
