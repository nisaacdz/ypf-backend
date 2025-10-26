import swaggerJsdoc from "swagger-jsdoc";
import variables from "@/configs/env";

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
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Error message",
            },
          },
        },
        PaginationQuery: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              minimum: 1,
              default: 1,
              description: "Page number",
            },
            pageSize: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 10,
              description: "Number of items per page",
            },
            search: {
              type: "string",
              description: "Search query",
            },
          },
        },
      },
    },
  },
  apis: ["./features/api/v1/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
