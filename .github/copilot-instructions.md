# GitHub Copilot Instructions for YPF Backend

This document provides context and guidelines for GitHub Copilot when working with the YPF Africa backend codebase.

## Project Overview

YPF Backend is a Node.js/Express API server built with TypeScript, using PostgreSQL with Drizzle ORM for database operations. The project follows a feature-based architecture with clear separation of concerns.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express 5.x
- **Database**: PostgreSQL with Drizzle ORM
- **Testing**: Vitest for unit and integration tests
- **Validation**: Zod schemas
- **API Documentation**: Swagger/OpenAPI
- **Linting**: ESLint with Prettier
- **Key Libraries**: Socket.IO, ImageKit, Azure Storage, JWT, bcrypt

## Critical Code Conventions

### Import Paths

- **ALWAYS** use the `@/` alias for imports from the project root
- **NEVER** use relative paths like `../../..`
- The `@/` alias is configured in `tsconfig.json` and resolves to the project root

```typescript
// ✅ Correct
import dbClient from "@/configs/db";
import { ApiResponse } from "@/shared/types";
import apiRouter from "@/features/api/v1";

// ❌ Incorrect
import dbClient from "../../configs/db";
import { ApiResponse } from "../../../shared/types";
```

### Environment Variables

- **NEVER** use `process.env` directly in code
- **ALWAYS** import the sanitized `variables` object from `@/configs/env`
- All environment variables are validated and typed

```typescript
// ✅ Correct
import variables from "@/configs/env";
const port = variables.app.port;
const dbUrl = variables.db.url;

// ❌ Incorrect
const port = process.env.PORT;
const dbUrl = process.env.DATABASE_URL;
```

## Project Structure

### Directory Organization

```
├── server.ts           # Main application entry point
├── configs/            # Configuration modules (db, env, emailer, etc.)
├── db/                 # Drizzle ORM schema definitions and migrations
├── features/           # Feature modules
│   ├── api/           # API routes organized by version
│   └── chat/          # WebSocket/real-time features
├── shared/             # Reusable code across features
│   ├── dtos/          # Data Transfer Objects
│   ├── middlewares/   # Express middlewares
│   ├── services/      # Business logic and database operations
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Small reusable helpers
│   └── validators/    # Zod validation schemas
├── scripts/            # Standalone utility scripts (migrate, seed, etc.)
└── tests/              # Test files (unit and integration)
```

### API Structure Guidelines

When working with API routes:

1. **Routes** live in `features/api/v{version}/`
2. **Handlers** should be lean and extracted to separate files (e.g., `*Handler.ts`)
   - Take only necessary data, not entire `req` and `res` objects
   - Call services for business logic
   - Return structured `ApiResponse` objects
3. **Services** (`shared/services/`) handle:
   - Database interactions via Drizzle ORM
   - Business logic
   - Error handling
   - Complex operations
4. **Utils** (`shared/utils/`) contain:
   - Small, reusable helpers
   - Domain-agnostic functions
   - Pure utility functions

### Request Validation

After using validation helpers (`validateQuery`, `validateBody`, `validateParams`):

- Access validated data via `req.Query`, `req.Body`, or `req.Params`
- These properties contain parsed and type-safe data from Zod schemas

```typescript
import { validateBody } from "@/shared/middlewares";
import { CreateEventSchema } from "@/shared/validators/activities";

router.post("/events", validateBody(CreateEventSchema), async (req, res) => {
  // req.Body is now typed and validated
  const eventData = req.Body;
  // ... rest of handler
});
```

## Response Patterns

All API responses should follow the `ApiResponse` type:

```typescript
type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};
```

Handlers return this structure, and middleware handles sending the response.

## Error Handling

- Use the `AppError` class for throwing custom errors
- The `errorHandler` middleware catches and formats errors
- Include meaningful error messages and appropriate HTTP status codes

```typescript
import { AppError } from "@/shared/types";

if (!resource) {
  throw new AppError("Resource not found", 404);
}
```

## Database Operations

- Use the `dbClient` connection from `@/configs/db`
- Access the Drizzle client via `dbClient.db`
- Schema definitions are in `db/schema/`
- Use Drizzle's query builder for type-safe queries

```typescript
import dbClient from "@/configs/db";
import { Events } from "@/db/schema/activities";

const events = await dbClient.db.select().from(Events).where(...);
```

## Testing Guidelines

- Tests are in the `tests/` directory
- Use Vitest as the test runner
- Structure: `tests/unit/` and `tests/integration/`
- Test utilities available in `tests/helpers.ts` and `tests/factories.ts`

Run tests with:

```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # With coverage report
```

## Development Workflow

### Running the Application

```bash
npm install          # Install dependencies
npm run dev         # Start development server with hot reload
npm run build       # Compile TypeScript
npm start           # Run compiled JavaScript
```

### Code Quality

```bash
npm run lint        # Check code style
npm run lint:fix    # Auto-fix linting issues
```

### Scripts

Utility scripts are in `scripts/` directory:

```bash
npm run script      # Run scripts via scripts/run.ts
```

## Swagger Documentation

- API documentation is automatically generated
- Accessible at `/docs` endpoint when server is running
- Use JSDoc comments for route documentation

## TypeScript Configuration

- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Path alias `@/*` maps to project root
- All `.ts` files are included except `node_modules`

## Key Middleware

- `helmet` - Security headers
- `cors` - CORS configuration with allowed origins from env
- `morgan` - Request logging
- `express-rate-limit` - Rate limiting
- `errorHandler` - Global error handling
- `filter` - Custom request filtering

## Socket.IO

Real-time features use Socket.IO. Implementation details are in `features/chat/`.

## File Uploads

- Use `multer` for handling file uploads
- Image processing with `sharp`
- Storage options: Azure Blob Storage, ImageKit

## Authentication & Authorization

- JWT-based authentication with `jsonwebtoken`
- OAuth support via `openid-client`
- Password hashing with `bcryptjs`
- Authorization logic in `configs/authorizer/`

## Logging

- Use the `logger` instance from `@/configs/logger`
- Based on Pino for structured logging
- In development, uses pino-pretty for readable output

```typescript
import logger from "@/configs/logger";

logger.info("Operation completed");
logger.error("Error occurred", { error });
```

## Code Style Preferences

- Use async/await instead of callbacks or raw promises
- Prefer const over let
- Use TypeScript types, avoid `any`
- Follow existing naming conventions (camelCase for variables/functions)
- Keep functions small and focused
- Extract complex logic into services
- Add JSDoc comments for public APIs

## Common Pitfalls to Avoid

1. Don't use `process.env` directly - use `variables` from `@/configs/env`
2. Don't use relative import paths - use `@/` alias
3. Don't pass entire `req`/`res` objects to handlers - extract needed data
4. Don't create circular dependencies between modules
5. Don't skip validation - always use Zod schemas for user input
6. Don't commit environment files (`.env`) - use `.env.example` as template

## Additional Resources

- Project documentation in `docs/` directory
- README.md for setup and getting started
- Drizzle ORM documentation: https://orm.drizzle.team/
