import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import server from "@/configs/server";
import { hashSync } from "bcryptjs";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { generateTestUser, generateTestChapter } from "../factories";

describe("Chapters API", () => {
  let authTokenCookie: string;

  const testUser = generateTestUser();
  const testChapter = generateTestChapter();

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

    // Create test user
    const hashedPassword = hashSync(testUser.password, 10);
    await dbClient.db.insert(schema.Users).values({
      email: testUser.email,
      password: hashedPassword,
      constituentId: testUser.constituentId,
      username: testUser.email,
    });

    // Create a member for testing (required for MEMBER profile)
    await dbClient.db.insert(schema.Members).values({
      constituentId: testUser.constituentId,
      startedAt: new Date(),
    });

    // Create a test chapter
    const [newChapter] = await dbClient.db
      .insert(schema.Chapters)
      .values({
        name: testChapter.name,
        country: testChapter.country,
        description: testChapter.description,
        foundingDate: testChapter.foundingDate,
      })
      .returning();

    testChapter.id = newChapter.id;

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
    // Clean up test chapter
    if (testChapter.id) {
      await dbClient.db
        .delete(schema.Chapters)
        .where(eq(schema.Chapters.id, testChapter.id));
    }

    // Clean up test user and constituent
    if (testUser.constituentId) {
      await dbClient.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId));
    }
  });

  describe("GET /api/v1/chapters", () => {
    it("should get list of chapters", async () => {
      const response = await request(server)
        .get("/api/v1/chapters")
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

    it("should get list of chapters with pagination parameters", async () => {
      const response = await request(server)
        .get("/api/v1/chapters?page=1&pageSize=5")
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it("should search chapters by name", async () => {
      const response = await request(server)
        .get(`/api/v1/chapters?search=${encodeURIComponent(testChapter.name)}`)
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: testChapter.name,
          }),
        ]),
      );
    });

    it("should reject request without session cookie", async () => {
      const response = await request(server)
        .get("/api/v1/chapters")
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should reject request with invalid page parameter", async () => {
      const response = await request(server)
        .get("/api/v1/chapters?page=0")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should reject request with invalid pageSize parameter", async () => {
      const response = await request(server)
        .get("/api/v1/chapters?pageSize=101")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });
  });

  describe("GET /api/v1/chapters/:id", () => {
    it("should get chapter details with valid session cookie", async () => {
      const response = await request(server)
        .get(`/api/v1/chapters/${testChapter.id}`)
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.id).toBe(testChapter.id);
      expect(response.body.data.name).toBe(testChapter.name);
      expect(response.body.data.country).toBe(testChapter.country);
      expect(response.body.data.description).toBe(testChapter.description);
      expect(response.body.data).toHaveProperty("foundingDate");
      expect(response.body.data).toHaveProperty("featuredMedia");
      expect(Array.isArray(response.body.data.featuredMedia)).toBe(true);
      expect(response.body.data).toHaveProperty("isActive");
      expect(response.body.data.isActive).toBe(true);
    });

    it("should reject request without session cookie", async () => {
      const response = await request(server)
        .get(`/api/v1/chapters/${testChapter.id}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid chapter ID format", async () => {
      const response = await request(server)
        .get("/api/v1/chapters/invalid-uuid")
        .set("Cookie", authTokenCookie)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 404 for non-existent chapter ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await request(server)
        .get(`/api/v1/chapters/${nonExistentId}`)
        .set("Cookie", authTokenCookie)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Chapter not found");
    });
  });

  describe("PATCH /api/v1/chapters/:id", () => {
    let superAdminTokenCookie: string;
    let chapterLeadTokenCookie: string;
    let regularMemberTokenCookie: string;

    const superAdminUser = generateTestUser();
    const chapterLeadUser = generateTestUser();
    const regularMemberUser = generateTestUser();

    beforeAll(async () => {
      // Create SUPER_ADMIN user
      await dbClient.db
        .delete(schema.Users)
        .where(eq(schema.Users.email, superAdminUser.email));

      const [superAdminConstituent] = await dbClient.db
        .insert(schema.Constituents)
        .values({
          firstName: superAdminUser.name.firstName,
          lastName: superAdminUser.name.lastName,
        })
        .returning();

      superAdminUser.constituentId = superAdminConstituent.id;

      const hashedPasswordSuperAdmin = hashSync(superAdminUser.password, 10);
      await dbClient.db.insert(schema.Users).values({
        email: superAdminUser.email,
        password: hashedPasswordSuperAdmin,
        constituentId: superAdminUser.constituentId,
        username: superAdminUser.email,
      });

      // Create admin profile for super admin
      const [admin] = await dbClient.db
        .insert(schema.Admins)
        .values({
          constituentId: superAdminUser.constituentId,
          startedAt: new Date(),
        })
        .returning();

      // Assign SUPER_ADMIN role
      await dbClient.db.insert(schema.AdminRolesAssignments).values({
        adminId: admin.id,
        role: "SUPER_ADMIN",
        startedAt: new Date(),
      });

      // Create chapter lead user
      await dbClient.db
        .delete(schema.Users)
        .where(eq(schema.Users.email, chapterLeadUser.email));

      const [chapterLeadConstituent] = await dbClient.db
        .insert(schema.Constituents)
        .values({
          firstName: chapterLeadUser.name.firstName,
          lastName: chapterLeadUser.name.lastName,
        })
        .returning();

      chapterLeadUser.constituentId = chapterLeadConstituent.id;

      const hashedPasswordChapterLead = hashSync(chapterLeadUser.password, 10);
      await dbClient.db.insert(schema.Users).values({
        email: chapterLeadUser.email,
        password: hashedPasswordChapterLead,
        constituentId: chapterLeadUser.constituentId,
        username: chapterLeadUser.email,
      });

      // Create member profile for chapter lead
      const [member] = await dbClient.db
        .insert(schema.Members)
        .values({
          constituentId: chapterLeadUser.constituentId,
          startedAt: new Date(),
        })
        .returning();

      // Create or get chapter lead title for this chapter
      const [leadTitle] = await dbClient.db
        .insert(schema.MemberTitles)
        .values({
          id: `lead-${testChapter.id}`,
          title: "lead",
          description: "Chapter Lead",
          _level: 1,
          chapterId: testChapter.id,
        })
        .onConflictDoNothing()
        .returning();

      // Assign chapter lead title
      await dbClient.db.insert(schema.MemberTitlesAssignments).values({
        memberId: member.id,
        titleId: leadTitle?.id || `lead-${testChapter.id}`,
        startedAt: new Date(),
      });

      // Create regular member user
      await dbClient.db
        .delete(schema.Users)
        .where(eq(schema.Users.email, regularMemberUser.email));

      const [regularMemberConstituent] = await dbClient.db
        .insert(schema.Constituents)
        .values({
          firstName: regularMemberUser.name.firstName,
          lastName: regularMemberUser.name.lastName,
        })
        .returning();

      regularMemberUser.constituentId = regularMemberConstituent.id;

      const hashedPasswordRegularMember = hashSync(
        regularMemberUser.password,
        10,
      );
      await dbClient.db.insert(schema.Users).values({
        email: regularMemberUser.email,
        password: hashedPasswordRegularMember,
        constituentId: regularMemberUser.constituentId,
        username: regularMemberUser.email,
      });

      // Create member profile for regular member (no special title)
      await dbClient.db.insert(schema.Members).values({
        constituentId: regularMemberUser.constituentId,
        startedAt: new Date(),
      });

      // Login as SUPER_ADMIN
      const superAdminLoginResponse = await request(server)
        .post("/api/v1/auth/login")
        .send({
          username: superAdminUser.email,
          password: superAdminUser.password,
        });

      let setCookieHeader = superAdminLoginResponse.headers["set-cookie"];
      let cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

      superAdminTokenCookie = [
        cookies.find((c) => c.includes("access_token")),
        cookies.find((c) => c.includes("refresh_token")),
      ]
        .filter(Boolean)
        .map((c) => c?.split(";")[0])
        .join("; ");

      // Login as chapter lead
      const chapterLeadLoginResponse = await request(server)
        .post("/api/v1/auth/login")
        .send({
          username: chapterLeadUser.email,
          password: chapterLeadUser.password,
        });

      setCookieHeader = chapterLeadLoginResponse.headers["set-cookie"];
      cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

      chapterLeadTokenCookie = [
        cookies.find((c) => c.includes("access_token")),
        cookies.find((c) => c.includes("refresh_token")),
      ]
        .filter(Boolean)
        .map((c) => c?.split(";")[0])
        .join("; ");

      // Login as regular member
      const regularMemberLoginResponse = await request(server)
        .post("/api/v1/auth/login")
        .send({
          username: regularMemberUser.email,
          password: regularMemberUser.password,
        });

      setCookieHeader = regularMemberLoginResponse.headers["set-cookie"];
      cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

      regularMemberTokenCookie = [
        cookies.find((c) => c.includes("access_token")),
        cookies.find((c) => c.includes("refresh_token")),
      ]
        .filter(Boolean)
        .map((c) => c?.split(";")[0])
        .join("; ");
    });

    afterAll(async () => {
      // Clean up users
      if (superAdminUser.constituentId) {
        await dbClient.db
          .delete(schema.Constituents)
          .where(eq(schema.Constituents.id, superAdminUser.constituentId));
      }
      if (chapterLeadUser.constituentId) {
        await dbClient.db
          .delete(schema.Constituents)
          .where(eq(schema.Constituents.id, chapterLeadUser.constituentId));
      }
      if (regularMemberUser.constituentId) {
        await dbClient.db
          .delete(schema.Constituents)
          .where(eq(schema.Constituents.id, regularMemberUser.constituentId));
      }
    });

    it("should allow SUPER_ADMIN to update chapter name", async () => {
      const newName = "Updated Chapter Name";
      const response = await request(server)
        .patch(`/api/v1/chapters/${testChapter.id}`)
        .set("Cookie", superAdminTokenCookie)
        .send({ name: newName })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newName);
      expect(response.body.data.id).toBe(testChapter.id);
    });

    it("should allow SUPER_ADMIN to update chapter description", async () => {
      const newDescription = "This is an updated description for testing";
      const response = await request(server)
        .patch(`/api/v1/chapters/${testChapter.id}`)
        .set("Cookie", superAdminTokenCookie)
        .send({ description: newDescription })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe(newDescription);
    });

    it("should allow SUPER_ADMIN to update chapter foundingDate", async () => {
      const newFoundingDate = new Date("2020-01-15");
      const response = await request(server)
        .patch(`/api/v1/chapters/${testChapter.id}`)
        .set("Cookie", superAdminTokenCookie)
        .send({ foundingDate: newFoundingDate.toISOString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(new Date(response.body.data.foundingDate).toDateString()).toBe(
        newFoundingDate.toDateString(),
      );
    });

    it("should allow SUPER_ADMIN to update multiple fields at once", async () => {
      const updates = {
        name: "Multi-Update Test Chapter",
        description: "Testing multiple field updates",
        foundingDate: new Date("2019-05-10").toISOString(),
      };

      const response = await request(server)
        .patch(`/api/v1/chapters/${testChapter.id}`)
        .set("Cookie", superAdminTokenCookie)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updates.name);
      expect(response.body.data.description).toBe(updates.description);
    });

    it("should allow chapter lead to update their chapter", async () => {
      const newName = "Chapter Lead Updated Name";
      const response = await request(server)
        .patch(`/api/v1/chapters/${testChapter.id}`)
        .set("Cookie", chapterLeadTokenCookie)
        .send({ name: newName })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newName);
    });

    it("should reject regular member trying to update chapter", async () => {
      const response = await request(server)
        .patch(`/api/v1/chapters/${testChapter.id}`)
        .set("Cookie", regularMemberTokenCookie)
        .send({ name: "Should not work" })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it("should reject unauthenticated request", async () => {
      const response = await request(server)
        .patch(`/api/v1/chapters/${testChapter.id}`)
        .send({ name: "Should not work" })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should return 400 for invalid chapter ID format", async () => {
      const response = await request(server)
        .patch("/api/v1/chapters/invalid-uuid")
        .set("Cookie", superAdminTokenCookie)
        .send({ name: "Test" })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should return 404 for non-existent chapter ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await request(server)
        .patch(`/api/v1/chapters/${nonExistentId}`)
        .set("Cookie", superAdminTokenCookie)
        .send({ name: "Test" })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Chapter not found");
    });

    it("should reject empty name", async () => {
      const response = await request(server)
        .patch(`/api/v1/chapters/${testChapter.id}`)
        .set("Cookie", superAdminTokenCookie)
        .send({ name: "" })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should handle partial updates correctly", async () => {
      // First, get current state
      const currentResponse = await request(server)
        .get(`/api/v1/chapters/${testChapter.id}`)
        .set("Cookie", authTokenCookie);

      const currentDescription = currentResponse.body.data.description;

      // Update only name
      const response = await request(server)
        .patch(`/api/v1/chapters/${testChapter.id}`)
        .set("Cookie", superAdminTokenCookie)
        .send({ name: "Partial Update Test" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe("Partial Update Test");
      // Description should remain unchanged
      expect(response.body.data.description).toBe(currentDescription);
    });
  });
});
