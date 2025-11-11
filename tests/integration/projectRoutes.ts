import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import server from "@/configs/server";
import { hashSync } from "bcryptjs";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import {
  generateTestUser,
  generateTestChapter,
  generateTestProject,
} from "../factories";

interface ProjectResponse {
  id: string;
  title: string;
  abstract?: string;
  status: string;
  chapterName?: string;
}

describe("Projects API", () => {
  let authTokenCookie: string;

  const testUser = generateTestUser();
  const testChapter = generateTestChapter();
  const testProject = generateTestProject();

  const testData = {
    chapterId: "",
    projectId: "",
    projectMediaId: 0,
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
    await dbClient.db.insert(schema.Members).values({
      constituentId: testUser.constituentId,
      startedAt: new Date(),
    });

    // Create an admin for testing (needed for PUT/POST/PATCH permissions)
    await dbClient.db.insert(schema.Admins).values({
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

    testData.chapterId = newChapter.id;

    // Create a test project
    const [newProject] = await dbClient.db
      .insert(schema.Projects)
      .values({
        title: testProject.title,
        abstract: testProject.abstract,
        scheduledStart: testProject.scheduledStart,
        scheduledEnd: testProject.scheduledEnd,
        status: "ONGOING",
        chapterId: testData.chapterId,
      })
      .returning();

    testData.projectId = newProject.id;

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
    // Clean up test data
    if (testData.projectId) {
      await dbClient.db
        .delete(schema.Projects)
        .where(eq(schema.Projects.id, testData.projectId));
    }
    if (testData.chapterId) {
      await dbClient.db
        .delete(schema.Chapters)
        .where(eq(schema.Chapters.id, testData.chapterId));
    }
    if (testUser.constituentId) {
      await dbClient.db
        .delete(schema.Constituents)
        .where(eq(schema.Constituents.id, testUser.constituentId));
    }
  });

  describe("GET /api/v1/projects", () => {
    it("should get list of projects without authentication", async () => {
      const response = await request(server)
        .get("/api/v1/projects")
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

    it("should get list of projects with authentication", async () => {
      const response = await request(server)
        .get("/api/v1/projects")
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);

      // Check if our test project is in the list
      const foundProject = response.body.data.items.find(
        (p: ProjectResponse) => p.id === testData.projectId,
      );
      if (foundProject) {
        expect(foundProject.title).toBe(testProject.title);
        expect(foundProject.abstract).toBe(testProject.abstract);
        expect(foundProject.chapterName).toBe(testChapter.name);
      }
    });

    it("should support pagination", async () => {
      const response = await request(server)
        .get("/api/v1/projects?page=1&pageSize=5")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it("should support search by project title", async () => {
      const response = await request(server)
        .get("/api/v1/projects?search=Test Project")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();

      // If we find results, they should contain the search term in the title
      if (response.body.data.items.length > 0) {
        const hasMatchingTitle = response.body.data.items.some(
          (p: ProjectResponse) =>
            p.title.toLowerCase().includes("test project"),
        );
        expect(hasMatchingTitle).toBe(true);
      }
    });

    it("should support filtering by status", async () => {
      const response = await request(server)
        .get("/api/v1/projects?filterStatus=ONGOING")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();

      // All returned projects should have ONGOING status
      if (response.body.data.items.length > 0) {
        const allInProgress = response.body.data.items.every(
          (p: ProjectResponse) => p.status === "ONGOING",
        );
        expect(allInProgress).toBe(true);
      }
    });

    it("should return 400 for invalid pagination parameters", async () => {
      const response = await request(server)
        .get("/api/v1/projects?page=0")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid pageSize", async () => {
      const response = await request(server)
        .get("/api/v1/projects?pageSize=101")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid status filter", async () => {
      const response = await request(server)
        .get("/api/v1/projects?filterStatus=INVALID_STATUS")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });
  });

  describe("POST /api/v1/projects", () => {
    let createdProjectId: string;

    afterAll(async () => {
      // Clean up created project
      if (createdProjectId) {
        await dbClient.db
          .delete(schema.Projects)
          .where(eq(schema.Projects.id, createdProjectId));
      }
    });

    it("should create a new project with authentication", async () => {
      const newProjectData = generateTestProject();
      const newProject = {
        title: newProjectData.title,
        abstract: newProjectData.abstract,
        description: newProjectData.description,
        scheduledStart: newProjectData.scheduledStart.toISOString(),
        scheduledEnd: newProjectData.scheduledEnd.toISOString(),
        status: "UPCOMING",
        chapterId: testData.chapterId,
      };

      const response = await request(server)
        .post("/api/v1/projects")
        .set("Cookie", authTokenCookie)
        .send(newProject)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(typeof response.body.data).toBe("string");

      createdProjectId = response.body.data;

      // Verify the project was created
      const getResponse = await request(server)
        .get(`/api/v1/projects/${createdProjectId}`)
        .expect(200);

      expect(getResponse.body.data.title).toBe(newProjectData.title);
      expect(getResponse.body.data.abstract).toBe(newProjectData.abstract);
      expect(getResponse.body.data.status).toBe("UPCOMING");
    });

    it("should return 401 without authentication", async () => {
      const futureStart = new Date();
      futureStart.setMonth(futureStart.getMonth() + 1);
      const futureEnd = new Date(futureStart);
      futureEnd.setMonth(futureEnd.getMonth() + 6);

      const newProject = {
        title: "Unauthorized Project",
        scheduledStart: futureStart.toISOString(),
        scheduledEnd: futureEnd.toISOString(),
        status: "UPCOMING",
      };

      await request(server)
        .post("/api/v1/projects")
        .send(newProject)
        .expect(401);
    });

    it("should return 400 for missing required fields", async () => {
      const invalidProject = {
        abstract: "Missing title and dates",
      };

      await request(server)
        .post("/api/v1/projects")
        .set("Cookie", authTokenCookie)
        .send(invalidProject)
        .expect(400);
    });

    it("should return 400 for invalid title length", async () => {
      const futureStart = new Date();
      futureStart.setMonth(futureStart.getMonth() + 1);
      const futureEnd = new Date(futureStart);
      futureEnd.setMonth(futureEnd.getMonth() + 6);

      const invalidProject = {
        title: "AB",
        scheduledStart: futureStart.toISOString(),
        scheduledEnd: futureEnd.toISOString(),
        status: "UPCOMING",
      };

      await request(server)
        .post("/api/v1/projects")
        .set("Cookie", authTokenCookie)
        .send(invalidProject)
        .expect(400);
    });

    it("should return 400 for invalid status", async () => {
      const futureStart = new Date();
      futureStart.setMonth(futureStart.getMonth() + 1);
      const futureEnd = new Date(futureStart);
      futureEnd.setMonth(futureEnd.getMonth() + 6);

      const invalidProject = {
        title: "Project with Invalid Status",
        scheduledStart: futureStart.toISOString(),
        scheduledEnd: futureEnd.toISOString(),
        status: "INVALID_STATUS",
      };

      await request(server)
        .post("/api/v1/projects")
        .set("Cookie", authTokenCookie)
        .send(invalidProject)
        .expect(400);
    });

    it("should return 400 for invalid chapter ID format", async () => {
      const futureStart = new Date();
      futureStart.setMonth(futureStart.getMonth() + 1);
      const futureEnd = new Date(futureStart);
      futureEnd.setMonth(futureEnd.getMonth() + 6);

      const invalidProject = {
        title: "Project with Invalid Chapter",
        scheduledStart: futureStart.toISOString(),
        scheduledEnd: futureEnd.toISOString(),
        status: "UPCOMING",
        chapterId: "invalid-uuid",
      };

      await request(server)
        .post("/api/v1/projects")
        .set("Cookie", authTokenCookie)
        .send(invalidProject)
        .expect(400);
    });
  });

  describe("GET /api/v1/projects/:id", () => {
    it("should get project details without authentication", async () => {
      const response = await request(server)
        .get(`/api/v1/projects/${testData.projectId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testData.projectId);
      expect(response.body.data.title).toBe(testProject.title);
      expect(response.body.data.abstract).toBe(testProject.abstract);
      expect(response.body.data.status).toBe("ONGOING");
      expect(response.body.data.chapter).toBeDefined();
      expect(response.body.data.chapter.id).toBe(testData.chapterId);
      expect(response.body.data.chapter.name).toBe(testChapter.name);
    });

    it("should get project details with authentication", async () => {
      const response = await request(server)
        .get(`/api/v1/projects/${testData.projectId}`)
        .set("Cookie", authTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testData.projectId);
    });

    it("should return 404 for non-existent project", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request(server)
        .get(`/api/v1/projects/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid project ID", async () => {
      const response = await request(server)
        .get("/api/v1/projects/invalid-id")
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/v1/projects/:id", () => {
    it("should update project details with authentication", async () => {
      const updateData = {
        title: "Updated Test Project",
        abstract: "Updated abstract",
        description: "Updated description",
        status: "COMPLETED",
      };

      const response = await request(server)
        .put(`/api/v1/projects/${testData.projectId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify the update by fetching the project
      const getResponse = await request(server)
        .get(`/api/v1/projects/${testData.projectId}`)
        .expect(200);

      expect(getResponse.body.data.title).toBe("Updated Test Project");
      expect(getResponse.body.data.abstract).toBe("Updated abstract");
      expect(getResponse.body.data.description).toBe("Updated description");
      expect(getResponse.body.data.status).toBe("COMPLETED");
    });

    it("should update partial project details", async () => {
      const updateData = {
        title: "Partially Updated Project",
      };

      const response = await request(server)
        .put(`/api/v1/projects/${testData.projectId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      const getResponse = await request(server)
        .get(`/api/v1/projects/${testData.projectId}`)
        .expect(200);

      expect(getResponse.body.data.title).toBe("Partially Updated Project");
      expect(getResponse.body.data.abstract).toBe("Updated abstract");
    });

    it("should return 401 without authentication", async () => {
      const updateData = {
        title: "Unauthorized Update",
      };

      await request(server)
        .put(`/api/v1/projects/${testData.projectId}`)
        .send(updateData)
        .expect(401);
    });

    it("should return 404 for non-existent project", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const updateData = {
        title: "Update Non-existent",
      };

      const response = await request(server)
        .put(`/api/v1/projects/${fakeId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid update data", async () => {
      const updateData = {
        title: "AB",
      };

      await request(server)
        .put(`/api/v1/projects/${testData.projectId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(400);
    });

    it("should return 400 for invalid status", async () => {
      const updateData = {
        status: "INVALID_STATUS",
      };

      await request(server)
        .put(`/api/v1/projects/${testData.projectId}`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(400);
    });
  });

  describe("GET /api/v1/projects/:id/media", () => {
    it("should get empty media list for project without media", async () => {
      const response = await request(server)
        .get(`/api/v1/projects/${testData.projectId}/media`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("items");
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBe(0);
      expect(response.body.data).toHaveProperty("page");
      expect(response.body.data).toHaveProperty("pageSize");
      expect(response.body.data).toHaveProperty("total");
    });

    it("should support pagination for project media", async () => {
      const response = await request(server)
        .get(`/api/v1/projects/${testData.projectId}/media?page=1&pageSize=5`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it("should return 400 for invalid project ID", async () => {
      await request(server)
        .get("/api/v1/projects/invalid-id/media")
        .expect(400);
    });
  });

  describe("PATCH /api/v1/projects/:id/media", () => {
    // Note: The route is /projects/:projectMediaId/media (not /projects/media/:projectMediaId like events)
    // The :id parameter refers to the project media ID (number), not the project ID (UUID)
    beforeAll(async () => {
      // Create a test medium in the Media table
      const [newMedium] = await dbClient.db
        .insert(schema.Media)
        .values({
          externalId: `test-project-media-${Date.now()}`,
          type: "PICTURE",
          width: 1920,
          height: 1080,
          size: 1024000,
          uploadedBy: testUser.constituentId,
        })
        .returning();

      // Create a ProjectMedia record
      const [projectMedia] = await dbClient.db
        .insert(schema.ProjectMedia)
        .values({
          projectId: testData.projectId,
          mediumId: newMedium.id,
          caption: "Original caption",
          isFeatured: false,
        })
        .returning();

      testData.projectMediaId = projectMedia.id;
    });

    afterAll(async () => {
      // Clean up test media
      if (testData.projectMediaId) {
        await dbClient.db
          .delete(schema.ProjectMedia)
          .where(eq(schema.ProjectMedia.id, testData.projectMediaId));
      }
    });

    it("should update project media caption and isFeatured", async () => {
      const updateData = {
        caption: "Updated caption",
        isFeatured: true,
      };

      const response = await request(server)
        .patch(`/api/v1/projects/${testData.projectMediaId}/media`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify the update
      const [updatedMedia] = await dbClient.db
        .select()
        .from(schema.ProjectMedia)
        .where(eq(schema.ProjectMedia.id, testData.projectMediaId));

      expect(updatedMedia.caption).toBe("Updated caption");
      expect(updatedMedia.isFeatured).toBe(true);
    });

    it("should update only caption", async () => {
      const updateData = {
        caption: "Caption only update",
      };

      const response = await request(server)
        .patch(`/api/v1/projects/${testData.projectMediaId}/media`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify the update
      const [updatedMedia] = await dbClient.db
        .select()
        .from(schema.ProjectMedia)
        .where(eq(schema.ProjectMedia.id, testData.projectMediaId));

      expect(updatedMedia.caption).toBe("Caption only update");
      expect(updatedMedia.isFeatured).toBe(true); // Should retain previous value
    });

    it("should update only isFeatured", async () => {
      const updateData = {
        isFeatured: false,
      };

      const response = await request(server)
        .patch(`/api/v1/projects/${testData.projectMediaId}/media`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify the update
      const [updatedMedia] = await dbClient.db
        .select()
        .from(schema.ProjectMedia)
        .where(eq(schema.ProjectMedia.id, testData.projectMediaId));

      expect(updatedMedia.caption).toBe("Caption only update"); // Should retain previous value
      expect(updatedMedia.isFeatured).toBe(false);
    });

    it("should return 401 without authentication", async () => {
      const updateData = {
        caption: "Unauthorized update",
      };

      await request(server)
        .patch(`/api/v1/projects/${testData.projectMediaId}/media`)
        .send(updateData)
        .expect(401);
    });

    it("should return 404 for non-existent media", async () => {
      const fakeId = 999999;
      const updateData = {
        caption: "Update non-existent",
      };

      const response = await request(server)
        .patch(`/api/v1/projects/${fakeId}/media`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 400 for invalid caption length", async () => {
      const updateData = {
        caption: "A".repeat(256), // Exceeds 255 characters
      };

      await request(server)
        .patch(`/api/v1/projects/${testData.projectMediaId}/media`)
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(400);
    });

    it("should return 400 for invalid media ID", async () => {
      const updateData = {
        caption: "Test",
      };

      await request(server)
        .patch("/api/v1/projects/invalid/media")
        .set("Cookie", authTokenCookie)
        .send(updateData)
        .expect(400);
    });
  });
});
