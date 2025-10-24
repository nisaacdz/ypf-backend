import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createTestApp } from "../app";
import type { Express } from "express";
import { hashSync } from "bcryptjs";
import pgPool from "@/configs/db";
import schema from "@/db/schema";

describe("Committees API", () => {
  let app: Express;
  let authTokenCookie: string;

  const testUser = {
    email: "committees-test@example.com",
    password: "SecurePassword123!",
    name: {
      firstName: "Committees",
      lastName: "Test",
    },
    constituentId: "",
  };

  const testChapter = {
    id: "",
    name: "Test Chapter for Committees",
    country: "Test Country",
    foundingDate: new Date("2020-01-01"),
  };

  const testCommittee = {
    id: "",
    name: "Test Committee for Committees Integration Test",
    description: "This is a test committee",
  };

  const testCommitteeWithChapter = {
    id: "",
    name: "Test Chapter Committee for Committees Integration Test",
    description: "This is a test committee with chapter",
  };

  beforeAll(async () => {
    app = await createTestApp();

    // Clean up any existing test data first to avoid conflicts
    await pgPool.db
      .delete(schema.Committees)
      .where(
        eq(
          schema.Committees.name,
          "Test Committee for Committees Integration Test",
        ),
      );
    await pgPool.db
      .delete(schema.Committees)
      .where(
        eq(
          schema.Committees.name,
          "Test Chapter Committee for Committees Integration Test",
        ),
      );

    // Clean up any existing test user
    await pgPool.db
      .delete(schema.Users)
      .where(eq(schema.Users.email, testUser.email));

    // Create test constituent
    const [newConstituent] = await pgPool.db
      .insert(schema.Constituents)
      .values({
        firstName: testUser.name.firstName,
        lastName: testUser.name.lastName,
      })
      .returning();

    testUser.constituentId = newConstituent.id;

    // Create test user
    const hashedPassword = hashSync(testUser.password, 10);
    await pgPool.db.insert(schema.Users).values({
      email: testUser.email,
      password: hashedPassword,
      constituentId: testUser.constituentId,
      username: testUser.email,
    });

    // Create a member for testing (required for MEMBER profile)
    await pgPool.db.insert(schema.Members).values({
      constituentId: testUser.constituentId,
      startedAt: new Date(),
    });

    // Create a test chapter
    const [newChapter] = await pgPool.db
      .insert(schema.Chapters)
      .values({
        name: testChapter.name,
        country: testChapter.country,
        foundingDate: testChapter.foundingDate,
      })
      .returning();

    testChapter.id = newChapter.id;

    // Create a test committee without chapter
    const [newCommittee] = await pgPool.db
      .insert(schema.Committees)
      .values({
        name: testCommittee.name,
        description: testCommittee.description,
      })
      .returning();

    testCommittee.id = newCommittee.id;

    // Create a test committee with chapter
    const [newChapterCommittee] = await pgPool.db
      .insert(schema.Committees)
      .values({
        name: testCommitteeWithChapter.name,
        description: testCommitteeWithChapter.description,
        chapterId: testChapter.id,
      })
      .returning();

    testCommitteeWithChapter.id = newChapterCommittee.id;

    // Login to get auth token
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
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
    // Clean up test committees
    if (testCommittee.id) {
      await pgPool.db
        .delete(schema.Committees)
        .where(eq(schema.Committees.id, testCommittee.id));
    }
    if (testCommitteeWithChapter.id) {
      await pgPool.db
        .delete(schema.Committees)
        .where(eq(schema.Committees.id, testCommitteeWithChapter.id));
    }

    // Clean up test chapter
    if (testChapter.id) {
      await pgPool.db
        .delete(schema.Chapters)
        .where(eq(schema.Chapters.id, testChapter.id));
    }

    // Clean up test user and constituent
    if (testUser.constituentId) {
      await pgPool.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId));
    }
  });

  describe("GET /api/v1/committees", () => {
    it("should get list of committees with valid session cookie", async () => {
      const response = await request(app)
        .get("/api/v1/committees")
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

    it("should get list of committees with pagination parameters", async () => {
      const response = await request(app)
        .get("/api/v1/committees?page=1&pageSize=5")
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it("should search committees by name", async () => {
      const response = await request(app)
        .get(
          `/api/v1/committees?search=${encodeURIComponent(testCommittee.name)}`,
        )
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: testCommittee.name,
          }),
        ]),
      );
    });

    it("should filter committees by chapterId", async () => {
      const response = await request(app)
        .get(`/api/v1/committees?chapterId=${testChapter.id}`)
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: testCommitteeWithChapter.name,
            chapterName: testChapter.name,
          }),
        ]),
      );
    });

    it("should reject request without session cookie", async () => {
      const response = await request(app)
        .get("/api/v1/committees")
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should reject request with invalid page parameter", async () => {
      const response = await request(app)
        .get("/api/v1/committees?page=0")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should reject request with invalid pageSize parameter", async () => {
      const response = await request(app)
        .get("/api/v1/committees?pageSize=101")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should reject request with invalid chapterId format", async () => {
      const response = await request(app)
        .get("/api/v1/committees?chapterId=invalid-uuid")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });
  });

  describe("GET /api/v1/committees/:id", () => {
    it("should get committee details with valid session cookie", async () => {
      const response = await request(app)
        .get(`/api/v1/committees/${testCommittee.id}`)
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.id).toBe(testCommittee.id);
      expect(response.body.data.name).toBe(testCommittee.name);
      expect(response.body.data.description).toBe(testCommittee.description);
      expect(response.body.data).toHaveProperty("featuredMedia");
      expect(Array.isArray(response.body.data.featuredMedia)).toBe(true);
      expect(response.body.data).toHaveProperty("isActive");
      expect(response.body.data.isActive).toBe(true);
      expect(response.body.data).toHaveProperty("createdAt");
    });

    it("should get committee details with chapter information", async () => {
      const response = await request(app)
        .get(`/api/v1/committees/${testCommitteeWithChapter.id}`)
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testCommitteeWithChapter.id);
      expect(response.body.data.name).toBe(testCommitteeWithChapter.name);
      expect(response.body.data).toHaveProperty("chapter");
      expect(response.body.data.chapter).toMatchObject({
        id: testChapter.id,
        name: testChapter.name,
      });
    });

    it("should reject request without session cookie", async () => {
      const response = await request(app)
        .get(`/api/v1/committees/${testCommittee.id}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid committee ID format", async () => {
      const response = await request(app)
        .get("/api/v1/committees/invalid-uuid")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 404 for non-existent committee ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .get(`/api/v1/committees/${nonExistentId}`)
        .set("Cookie", authTokenCookie)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Committee not found");
    });
  });
});
