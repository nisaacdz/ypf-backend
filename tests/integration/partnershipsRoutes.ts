import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import server from "@/configs/server";
import { hashSync } from "bcryptjs";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import {
  generateTestUser,
  generateTestOrganization,
  generateTestPartnership,
} from "../factories";

describe("Partnerships API", () => {
  let memberAuthTokenCookie: string;
  let adminAuthTokenCookie: string;

  const memberUser = generateTestUser();
  const adminUser = generateTestUser();
  const testOrganization = generateTestOrganization();
  const testPartnership = generateTestPartnership();

  beforeAll(async () => {
    // Clean up existing test users
    await dbClient.db
      .delete(schema.Users)
      .where(eq(schema.Users.email, memberUser.email));
    await dbClient.db
      .delete(schema.Users)
      .where(eq(schema.Users.email, adminUser.email));

    // Create member constituent and user
    const [memberConstituent] = await dbClient.db
      .insert(schema.Constituents)
      .values({
        firstName: memberUser.name.firstName,
        lastName: memberUser.name.lastName,
        email: memberUser.email,
      })
      .returning();

    memberUser.constituentId = memberConstituent.id;

    const hashedMemberPassword = hashSync(memberUser.password, 10);
    await dbClient.db.insert(schema.Users).values({
      email: memberUser.email,
      password: hashedMemberPassword,
      constituentId: memberUser.constituentId,
      username: memberUser.email,
    });

    // Create member profile for member user
    await dbClient.db.insert(schema.Members).values({
      constituentId: memberUser.constituentId,
      startedAt: new Date(),
    });

    // Create admin constituent and user
    const [adminConstituent] = await dbClient.db
      .insert(schema.Constituents)
      .values({
        firstName: adminUser.name.firstName,
        lastName: adminUser.name.lastName,
        email: adminUser.email,
      })
      .returning();

    adminUser.constituentId = adminConstituent.id;

    const hashedAdminPassword = hashSync(adminUser.password, 10);
    await dbClient.db.insert(schema.Users).values({
      email: adminUser.email,
      password: hashedAdminPassword,
      constituentId: adminUser.constituentId,
      username: adminUser.email,
    });

    // Create admin profile for admin user
    await dbClient.db.insert(schema.Admins).values({
      constituentId: adminUser.constituentId,
      startedAt: new Date(),
    });

    // Create test organization
    const [newOrg] = await dbClient.db
      .insert(schema.Organizations)
      .values({
        name: testOrganization.name,
        website: testOrganization.website,
        description: testOrganization.description,
        logoUrl: testOrganization.logoUrl,
        isActive: testOrganization.isActive,
      })
      .returning();

    testOrganization.id = newOrg.id;

    // Login as member to get auth token
    const memberLoginResponse = await request(server)
      .post("/api/v1/auth/login")
      .send({
        username: memberUser.email,
        password: memberUser.password,
      });

    const memberCookieHeader = memberLoginResponse.headers["set-cookie"];
    const memberCookies = Array.isArray(memberCookieHeader)
      ? memberCookieHeader
      : [memberCookieHeader];

    const memberAccessToken = memberCookies.find((c) =>
      c.includes("access_token"),
    );

    memberAuthTokenCookie = memberAccessToken?.split(";")[0] || "";

    // Login as admin to get auth token
    const adminLoginResponse = await request(server)
      .post("/api/v1/auth/login")
      .send({
        username: adminUser.email,
        password: adminUser.password,
      });

    const adminCookieHeader = adminLoginResponse.headers["set-cookie"];
    const adminCookies = Array.isArray(adminCookieHeader)
      ? adminCookieHeader
      : [adminCookieHeader];

    const adminAccessToken = adminCookies.find((c) =>
      c.includes("access_token"),
    );

    adminAuthTokenCookie = adminAccessToken?.split(";")[0] || "";
  });

  afterAll(async () => {
    // Clean up partnerships
    if (testPartnership.id) {
      await dbClient.db
        .delete(schema.Partnerships)
        .where(eq(schema.Partnerships.id, testPartnership.id));
    }

    // Clean up organization
    if (testOrganization.id) {
      await dbClient.db
        .delete(schema.Organizations)
        .where(eq(schema.Organizations.id, testOrganization.id));
    }

    // Clean up admin profile
    await dbClient.db
      .delete(schema.Admins)
      .where(eq(schema.Admins.constituentId, adminUser.constituentId));

    // Clean up member profile
    await dbClient.db
      .delete(schema.Members)
      .where(eq(schema.Members.constituentId, memberUser.constituentId));

    // Clean up users
    await dbClient.db
      .delete(schema.Users)
      .where(eq(schema.Users.email, memberUser.email));
    await dbClient.db
      .delete(schema.Users)
      .where(eq(schema.Users.email, adminUser.email));

    // Clean up constituents
    await dbClient.db
      .delete(schema.Constituents)
      .where(eq(schema.Constituents.id, memberUser.constituentId));
    await dbClient.db
      .delete(schema.Constituents)
      .where(eq(schema.Constituents.id, adminUser.constituentId));
  });

  describe("GET /api/v1/partnerships", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const response = await request(server).get("/api/v1/partnerships");

      expect(response.status).toBe(401);
    });

    it("should return paginated list for authenticated member", async () => {
      const response = await request(server)
        .get("/api/v1/partnerships")
        .set("Cookie", memberAuthTokenCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("items");
      expect(response.body.data).toHaveProperty("page");
      expect(response.body.data).toHaveProperty("pageSize");
      expect(response.body.data).toHaveProperty("total");
    });

    it("should support filtering by partnershipType", async () => {
      const response = await request(server)
        .get("/api/v1/partnerships?partnershipType=SPONSOR")
        .set("Cookie", memberAuthTokenCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should support pagination parameters", async () => {
      const response = await request(server)
        .get("/api/v1/partnerships?page=1&pageSize=5")
        .set("Cookie", memberAuthTokenCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.pageSize).toBe(5);
    });
  });

  describe("POST /api/v1/partnerships", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const response = await request(server).post("/api/v1/partnerships").send({
        organizationId: testOrganization.id,
        partnershipType: testPartnership.partnershipType,
        startedAt: testPartnership.startedAt.toISOString(),
      });

      expect(response.status).toBe(401);
    });

    it("should return 403 for member trying to create partnership", async () => {
      const response = await request(server)
        .post("/api/v1/partnerships")
        .set("Cookie", memberAuthTokenCookie)
        .field("organizationId", testOrganization.id)
        .field("partnershipType", testPartnership.partnershipType)
        .field("startedAt", testPartnership.startedAt.toISOString());

      expect(response.status).toBe(403);
    });

    it("should create partnership for admin", async () => {
      const response = await request(server)
        .post("/api/v1/partnerships")
        .set("Cookie", adminAuthTokenCookie)
        .field("organizationId", testOrganization.id)
        .field("partnershipType", testPartnership.partnershipType)
        .field("startedAt", testPartnership.startedAt.toISOString())
        .field("endedAt", testPartnership.endedAt.toISOString())
        .field("value", parseFloat(testPartnership.value));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data).toHaveProperty("message");

      // Store ID for subsequent tests and cleanup
      testPartnership.id = response.body.data.id;
    });

    it("should return 404 for non-existent organization", async () => {
      const response = await request(server)
        .post("/api/v1/partnerships")
        .set("Cookie", adminAuthTokenCookie)
        .field("organizationId", "00000000-0000-0000-0000-000000000000")
        .field("partnershipType", "SPONSOR")
        .field("startedAt", new Date().toISOString());

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/v1/partnerships/:id", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const response = await request(server).get(
        `/api/v1/partnerships/${testPartnership.id}`,
      );

      expect(response.status).toBe(401);
    });

    it("should return partnership details for authenticated member", async () => {
      const response = await request(server)
        .get(`/api/v1/partnerships/${testPartnership.id}`)
        .set("Cookie", memberAuthTokenCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id", testPartnership.id);
      expect(response.body.data).toHaveProperty("organization");
      expect(response.body.data.organization).toHaveProperty(
        "id",
        testOrganization.id,
      );
      expect(response.body.data).toHaveProperty("partnershipType");
      expect(response.body.data).toHaveProperty("isActive");
    });

    it("should return 404 for non-existent partnership", async () => {
      const response = await request(server)
        .get("/api/v1/partnerships/00000000-0000-0000-0000-000000000000")
        .set("Cookie", memberAuthTokenCookie);

      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid UUID", async () => {
      const response = await request(server)
        .get("/api/v1/partnerships/invalid-id")
        .set("Cookie", memberAuthTokenCookie);

      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/partnerships/:id", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const response = await request(server)
        .patch(`/api/v1/partnerships/${testPartnership.id}`)
        .send({ value: 50000 });

      expect(response.status).toBe(401);
    });

    it("should return 403 for member trying to update partnership", async () => {
      const response = await request(server)
        .patch(`/api/v1/partnerships/${testPartnership.id}`)
        .set("Cookie", memberAuthTokenCookie)
        .send({ value: 50000 });

      expect(response.status).toBe(403);
    });

    it("should update partnership for admin", async () => {
      const newValue = 75000;
      const response = await request(server)
        .patch(`/api/v1/partnerships/${testPartnership.id}`)
        .set("Cookie", adminAuthTokenCookie)
        .send({ value: newValue });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id", testPartnership.id);
      expect(response.body.data.message).toContain("updated");
    });

    it("should return 404 for non-existent partnership", async () => {
      const response = await request(server)
        .patch("/api/v1/partnerships/00000000-0000-0000-0000-000000000000")
        .set("Cookie", adminAuthTokenCookie)
        .send({ value: 50000 });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/partnerships/:id", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const response = await request(server).delete(
        `/api/v1/partnerships/${testPartnership.id}`,
      );

      expect(response.status).toBe(401);
    });

    it("should return 403 for member trying to delete partnership", async () => {
      const response = await request(server)
        .delete(`/api/v1/partnerships/${testPartnership.id}`)
        .set("Cookie", memberAuthTokenCookie);

      expect(response.status).toBe(403);
    });

    it("should delete partnership for admin", async () => {
      const response = await request(server)
        .delete(`/api/v1/partnerships/${testPartnership.id}`)
        .set("Cookie", adminAuthTokenCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain("deleted");

      // Clear the ID since it's deleted
      testPartnership.id = "";
    });

    it("should return 404 for non-existent partnership", async () => {
      const response = await request(server)
        .delete("/api/v1/partnerships/00000000-0000-0000-0000-000000000000")
        .set("Cookie", adminAuthTokenCookie);

      expect(response.status).toBe(404);
    });
  });
});
