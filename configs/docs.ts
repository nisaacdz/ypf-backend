import swaggerJsdoc from "swagger-jsdoc";
import variables from "@/configs/env";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

/**
 * Load all YAML files from a directory
 */
function loadYamlFiles(directory: string): any[] {
  const files: any[] = [];
  const dirPath = path.join(process.cwd(), directory);

  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const entries = fs.readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isFile() && entry.endsWith(".yaml")) {
      const content = fs.readFileSync(fullPath, "utf8");
      // Use safeLoad to prevent arbitrary code execution from malicious YAML
      const parsed = yaml.load(content, { schema: yaml.CORE_SCHEMA });
      files.push(parsed);
    }
  }

  return files;
}

/**
 * Merge component schemas from YAML files
 */
function loadComponentSchemas(): Record<string, any> {
  const schemas = loadYamlFiles("swagger/components");
  const merged: Record<string, any> = {};

  for (const schema of schemas) {
    Object.assign(merged, schema);
  }

  return merged;
}

/**
 * Merge paths from YAML files
 */
function loadPaths(): Record<string, any> {
  const pathFiles = loadYamlFiles("swagger/paths");
  const merged: Record<string, any> = {};

  for (const pathFile of pathFiles) {
    Object.assign(merged, pathFile);
  }

  return merged;
}

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "YPF Backend API",
      version: "1.0.0",
      description: "API documentation for YPF Backend services",
    },
    servers: [
      {
        url: `http://${variables.app.host}:${variables.app.port}`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "access_token",
          description: "Authentication token stored in httpOnly cookie",
        },
      },
      schemas: loadComponentSchemas(),
    },
    paths: loadPaths(),
    tags: [
      {
        name: "Dashboard",
        description: "Admin dashboard statistics and activity",
      },
      { name: "Events", description: "Event management endpoints" },
      { name: "Projects", description: "Project management endpoints" },
      { name: "Applications", description: "Application management endpoints" },
      {
        name: "Authentication",
        description: "Authentication and authorization",
      },
      { name: "Members", description: "Member management endpoints" },
      { name: "Donations", description: "Donation management endpoints" },
      { name: "Users", description: "User management endpoints" },
      { name: "Chapters", description: "Chapter management endpoints" },
      { name: "Committees", description: "Committee management endpoints" },
      { name: "Partnerships", description: "Partnership management endpoints" },
      { name: "Shop", description: "Shop product management endpoints" },
      { name: "Dues", description: "Member dues management endpoints" },
      {
        name: "Announcements",
        description: "Announcement management endpoints",
      },
      { name: "Transactions", description: "Financial transaction endpoints" },
      { name: "Constituents", description: "Constituent management endpoints" },
    ],
  },
  // Keep scanning TypeScript files for backwards compatibility during migration
  apis: ["./features/api/v1/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
