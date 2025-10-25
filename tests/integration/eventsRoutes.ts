import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createTestApp } from "../app";
import type { Express } from "express";
import { hashSync } from "bcryptjs";
import pgPool from "@/configs/db";
import schema from "@/db/schema";

interface EventResponse {
  id: string;
  name: string;
  location?: string;
  status: string;
  project?: {
    id: string;
    title: string;
  };
}

describe("Events API", () => {
  let app: Express;
  let authTokenCookie: string;

  const testUser = {
    email: "events-test@example.com",
    password: "SecurePassword123!",
    name: {
      firstName: "Events",
      lastName: "Test",
    },
    constituentId: "",
  };

  const testData = {
    chapterId: "",
    projectId: "",
    eventId: "",
  };

  beforeAll(async () => {
    app = await createTestApp();

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

    // Create a member for testing
    await pgPool.db.insert(schema.Members).values({
      constituentId: testUser.constituentId,
      startedAt: new Date(),
    });

    // Create a test chapter
    const [newChapter] = await pgPool.db
      .insert(schema.Chapters)
      .values({
        name: "Test Chapter for Events",
        country: "Test Country",
        foundingDate: new Date("2020-01-01"),
      })
      .returning();

    testData.chapterId = newChapter.id;

    // Create a test project
    const [newProject] = await pgPool.db
      .insert(schema.Projects)
      .values({
        title: "Test Project for Events",
        scheduledStart: new Date("2024-01-01"),
        scheduledEnd: new Date("2024-12-31"),
        status: "IN_PROGRESS",
        chapterId: testData.chapterId,
      })
      .returning();

    testData.projectId = newProject.id;

    // Create a test event
    const [newEvent] = await pgPool.db
      .insert(schema.Events)
      .values({
        name: "Test Event",
        location: "Test Location",
        scheduledStart: new Date("2024-06-01"),
        scheduledEnd: new Date("2024-06-02"),
        status: "UPCOMING",
        projectId: testData.projectId,
      })
      .returning();

    testData.eventId = newEvent.id;

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
    // Clean up test data
    if (testData.eventId) {
      await pgPool.db
        .delete(schema.Events)
        .where(eq(schema.Events.id, testData.eventId));
    }
    if (testData.projectId) {
      await pgPool.db
        .delete(schema.Projects)
        .where(eq(schema.Projects.id, testData.projectId));
    }
    if (testData.chapterId) {
      await pgPool.db
        .delete(schema.Chapters)
        .where(eq(schema.Chapters.id, testData.chapterId));
    }
    if (testUser.constituentId) {
      await pgPool.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId));
    }
  });

  describe("GET /api/v1/events", () => {
    it("should get list of events without authentication", async () => {
      const response = await request(app).get("/api/v1/events").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Events fetched successfully");
      expect(response.body.data).toHaveProperty("items");
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data).toHaveProperty("page");
      expect(response.body.data).toHaveProperty("pageSize");
      expect(response.body.data).toHaveProperty("total");
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(10);
    });

    it("should get list of events with authentication", async () => {
      const response = await request(app)
        .get("/api/v1/events")
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);

      // Check if our test event is in the list
      const testEvent = response.body.data.items.find(
        (e: EventResponse) => e.id === testData.eventId,
      );
      if (testEvent) {
        expect(testEvent.name).toBe("Test Event");
        expect(testEvent.location).toBe("Test Location");
        expect(testEvent.status).toBe("UPCOMING");
        expect(testEvent.project).toBeDefined();
        expect(testEvent.project?.id).toBe(testData.projectId);
        expect(testEvent.project?.title).toBe("Test Project for Events");
      }
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/v1/events?page=1&pageSize=5")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it("should support search by event name", async () => {
      const response = await request(app)
        .get("/api/v1/events?search=Test Event")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();

      // If we find results, they should contain the search term in the name
      if (response.body.data.items.length > 0) {
        const hasMatchingName = response.body.data.items.some(
          (e: EventResponse) =>
            e.name.toLowerCase().includes("test event") ||
            e.project?.title.toLowerCase().includes("test event"),
        );
        expect(hasMatchingName).toBe(true);
      }
    });

    it("should support search by project title", async () => {
      const response = await request(app)
        .get("/api/v1/events?search=Test Project")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();

      // If we find results, they should have a project with the search term
      if (response.body.data.items.length > 0) {
        const hasMatchingProject = response.body.data.items.some(
          (e: EventResponse) =>
            e.project?.title.toLowerCase().includes("test project") ||
            e.name.toLowerCase().includes("test project"),
        );
        expect(hasMatchingProject).toBe(true);
      }
    });

    it("should return 400 for invalid pagination parameters", async () => {
      const response = await request(app)
        .get("/api/v1/events?page=0")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid pageSize", async () => {
      const response = await request(app)
        .get("/api/v1/events?pageSize=101")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });
  });
});
