import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import server from "@/configs/server";
import { hashSync } from "bcryptjs";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { generateTestUser } from "../factories";
import { extractAccessTokenCookie } from "../helpers";

describe("Users API", () => {
  let authTokenCookie: string;

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

    const loginResponse = await request(server)
      .post("/api/v1/auth/login")
      .send({
        username: testUser.email,
        password: testUser.password,
      });

    authTokenCookie = extractAccessTokenCookie(
      loginResponse.headers["set-cookie"],
    );
  });

  afterAll(async () => {
    if (testUser.constituentId) {
      await dbClient.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId));
    }
  });

  describe("GET /api/v1/users/me", () => {
    it("should get the current user's profile with a valid session cookie", async () => {
      const response = await request(server)
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
      const response = await request(server)
        .get("/api/v1/users/me")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });
  });
});
