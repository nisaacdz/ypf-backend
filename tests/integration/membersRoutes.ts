import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import server from "@/configs/server";
import { hashSync } from "bcryptjs";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { generateTestUser } from "../factories";

describe("Members API", () => {
  let authTokenCookie: string;

  const testUser = generateTestUser();

  const testMember = {
    constituentId: "",
    memberId: "",
  };

  beforeAll(async () => {
    await dbClient.db
      .delete(schema.Users)
      .where(eq(schema.Users.email, testUser.email));

    // Create test constituent
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

    // Create a member for testing
    const [newMember] = await dbClient.db
      .insert(schema.Members)
      .values({
        constituentId: testUser.constituentId,
        startedAt: new Date(),
      })
      .returning();

    testMember.constituentId = testUser.constituentId;
    testMember.memberId = newMember.id;

    // Login to get auth token
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
    const refreshToken = cookies.find((c) => c.includes("refresh_token"));

    authTokenCookie = [accessToken, refreshToken]
      .filter(Boolean)
      .map((c) => c?.split(";")[0])
      .join("; ");
  });

  afterAll(async () => {
    if (testUser.constituentId) {
      await dbClient.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId));
    }
  });

  describe("GET /api/v1/members/:id", () => {
    it("should get member details with a valid session cookie", async () => {
      const response = await request(server)
        .get(`/api/v1/members/${testMember.constituentId}`)
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.id).toBe(testMember.constituentId);
      expect(response.body.data.firstName).toBe(testUser.name.firstName);
      expect(response.body.data.lastName).toBe(testUser.name.lastName);
      expect(response.body.data).toHaveProperty("contactInfos");
      expect(Array.isArray(response.body.data.contactInfos)).toBe(true);
      expect(response.body.data).toHaveProperty("titles");
      expect(Array.isArray(response.body.data.titles)).toBe(true);
      expect(response.body.data).toHaveProperty("joinedAt");
      expect(response.body.data).toHaveProperty("isActive");
      expect(response.body.data.isActive).toBe(true);
    });

    it("should reject the request if the session cookie is not provided", async () => {
      const response = await request(server)
        .get(`/api/v1/members/${testMember.constituentId}`)
        .expect(403); // Theoretically could succeed without authentication if permissions allow

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid member ID format", async () => {
      const response = await request(server)
        .get("/api/v1/members/invalid-uuid")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 404 for non-existent member ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await request(server)
        .get(`/api/v1/members/${nonExistentId}`)
        .set("Cookie", authTokenCookie)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Member not found");
    });
  });
});
