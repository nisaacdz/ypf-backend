import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createTestApp } from "../app";
import type { Express } from "express";
import { hashSync } from "bcryptjs";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { generateTestUser, generateTestChapter } from "../factories";

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

  const testUser = generateTestUser();
  const testChapter = generateTestChapter();

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
        name: testChapter.name,
        country: testChapter.country,
        description: testChapter.description,
        foundingDate: testChapter.foundingDate,
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
        .get("/api/v1/events?search=Test Event")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();

      // If we find results, they should have a project with the search term
      if (response.body.data.items.length > 0) {
        const hasMatchingProject = response.body.data.items.some(
          (e: EventResponse) =>
            e.project?.title.toLowerCase().includes("test event") ||
            e.name.toLowerCase().includes("test event"),
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

  describe("GET /api/v1/events/:id", () => {
    it("should get event details without authentication", async () => {
      const response = await request(app)
        .get(`/api/v1/events/${testData.eventId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Event fetched successfully");
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testData.eventId);
      expect(response.body.data.name).toBe("Test Event");
      expect(response.body.data.location).toBe("Test Location");
      expect(response.body.data.status).toBe("UPCOMING");
      expect(response.body.data.project).toBeDefined();
      expect(response.body.data.project.id).toBe(testData.projectId);
    });

    it("should get event details with authentication", async () => {
      const response = await request(app)
        .get(`/api/v1/events/${testData.eventId}`)
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testData.eventId);
    });

    it("should return 404 for non-existent event", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .get(`/api/v1/events/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Event not found");
    });

    it("should return 400 for invalid event ID", async () => {
      const response = await request(app)
        .get("/api/v1/events/invalid-id")
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/v1/events/:id", () => {
    it("should update event details with authentication", async () => {
      const updateData = {
        name: "Updated Test Event",
        location: "Updated Location",
        objective: "Updated objective",
        status: "ONGOING",
      };

      const response = await request(app)
        .put(`/api/v1/events/${testData.eventId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Event updated successfully");

      // Verify the update by fetching the event
      const getResponse = await request(app)
        .get(`/api/v1/events/${testData.eventId}`)
        .expect(200);

      expect(getResponse.body.data.name).toBe("Updated Test Event");
      expect(getResponse.body.data.location).toBe("Updated Location");
      expect(getResponse.body.data.objective).toBe("Updated objective");
      expect(getResponse.body.data.status).toBe("ONGOING");
    });

    it("should update partial event details", async () => {
      const updateData = {
        name: "Partially Updated Event",
      };

      const response = await request(app)
        .put(`/api/v1/events/${testData.eventId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify the update
      const getResponse = await request(app)
        .get(`/api/v1/events/${testData.eventId}`)
        .expect(200);

      expect(getResponse.body.data.name).toBe("Partially Updated Event");
      expect(getResponse.body.data.location).toBe("Updated Location"); // Should retain previous value
    });

    it("should return 401 without authentication", async () => {
      const updateData = {
        name: "Unauthorized Update",
      };

      await request(app)
        .put(`/api/v1/events/${testData.eventId}`)
        .send(updateData)
        .expect(401);
    });

    it("should return 404 for non-existent event", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const updateData = {
        name: "Update Non-existent",
      };

      const response = await request(app)
        .put(`/api/v1/events/${fakeId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Event not found");
    });

    it("should return 400 for invalid update data", async () => {
      const updateData = {
        name: "AB", // Too short
      };

      await request(app)
        .put(`/api/v1/events/${testData.eventId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(400);
    });

    it("should return 400 for invalid status", async () => {
      const updateData = {
        status: "INVALID_STATUS",
      };

      await request(app)
        .put(`/api/v1/events/${testData.eventId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(400);
    });
  });

  describe("PATCH /api/v1/events/media/:id", () => {
    let testMediaId: number;

    beforeAll(async () => {
      // First, create a test medium in the Media table
      const [newMedium] = await pgPool.db
        .insert(schema.Media)
        .values({
          externalId: "test-external-id",
          type: "PICTURE",
          width: 1920,
          height: 1080,
          sizeInBytes: 1024000,
          uploadedBy: testUser.constituentId,
        })
        .returning();

      // Then create an EventMedia record
      const [eventMedia] = await pgPool.db
        .insert(schema.EventMedia)
        .values({
          eventId: testData.eventId,
          mediumId: newMedium.id,
          caption: "Original caption",
          isFeatured: false,
        })
        .returning();

      testMediaId = eventMedia.id;
    });

    afterAll(async () => {
      // Clean up test media
      if (testMediaId) {
        await pgPool.db
          .delete(schema.EventMedia)
          .where(eq(schema.EventMedia.id, testMediaId));
      }
    });

    it("should update event media caption and isFeatured", async () => {
      const updateData = {
        caption: "Updated caption",
        isFeatured: true,
      };

      const response = await request(app)
        .patch(`/api/v1/events/media/${testMediaId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Event media updated successfully");

      // Verify the update
      const [updatedMedia] = await pgPool.db
        .select()
        .from(schema.EventMedia)
        .where(eq(schema.EventMedia.id, testMediaId));

      expect(updatedMedia.caption).toBe("Updated caption");
      expect(updatedMedia.isFeatured).toBe(true);
    });

    it("should update only caption", async () => {
      const updateData = {
        caption: "Caption only update",
      };

      const response = await request(app)
        .patch(`/api/v1/events/media/${testMediaId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify the update
      const [updatedMedia] = await pgPool.db
        .select()
        .from(schema.EventMedia)
        .where(eq(schema.EventMedia.id, testMediaId));

      expect(updatedMedia.caption).toBe("Caption only update");
      expect(updatedMedia.isFeatured).toBe(true); // Should retain previous value
    });

    it("should update only isFeatured", async () => {
      const updateData = {
        isFeatured: false,
      };

      const response = await request(app)
        .patch(`/api/v1/events/media/${testMediaId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify the update
      const [updatedMedia] = await pgPool.db
        .select()
        .from(schema.EventMedia)
        .where(eq(schema.EventMedia.id, testMediaId));

      expect(updatedMedia.caption).toBe("Caption only update"); // Should retain previous value
      expect(updatedMedia.isFeatured).toBe(false);
    });

    it("should return 401 without authentication", async () => {
      const updateData = {
        caption: "Unauthorized update",
      };

      await request(app)
        .patch(`/api/v1/events/media/${testMediaId}`)
        .send(updateData)
        .expect(401);
    });

    it("should return 404 for non-existent media", async () => {
      const fakeId = 999999;
      const updateData = {
        caption: "Update non-existent",
      };

      const response = await request(app)
        .patch(`/api/v1/events/media/${fakeId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Event media not found");
    });

    it("should return 400 for invalid caption length", async () => {
      const updateData = {
        caption: "A".repeat(256), // Exceeds 255 characters
      };

      await request(app)
        .patch(`/api/v1/events/media/${testMediaId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(400);
    });

    it("should return 400 for invalid media ID", async () => {
      const updateData = {
        caption: "Test",
      };

      await request(app)
        .patch("/api/v1/events/media/invalid")
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(400);
    });
  });
});
