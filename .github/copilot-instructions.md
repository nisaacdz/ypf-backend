# GitHub Copilot Instructions for YPF Backend

This document provides context and guidelines for GitHub Copilot when working with the YPF Africa backend codebase.

## 📚 Documentation & Context

**Primary Sources of Truth:**

1. **`README.md`**: Setup, project structure, and key conventions.
2. **`docs/` folder**: Detailed implementation patterns (Authorization, Financial Transactions, etc.).
3. **Codebase**: Read `configs/`, `shared/services/`, and `features/` to understand the actual implementation.

**Tech Stack:**

- Node.js / Express 5 / TypeScript
- PostgreSQL / Drizzle ORM
- Redis (caching via ioredis)
- pg-boss (background job queue)
- Socket.IO (WebSockets)
- Vitest (Testing)
- Zod (Validation)
- Pino (Logging)

## 🛠️ Development Workflow

### Pre-PR Checklist

Before submitting a Pull Request, you **MUST** ensure the following:

1. **Format Code**: Run Prettier to fix formatting issues.
   ```bash
   npx prettier --write .
   ```
2. **Build Test**: Ensure the project builds without errors.
   ```bash
   npm run build
   ```
3. **Run Tests**: Verify that all tests pass.
   ```bash
   npm test
   ```

### Running Scripts

Use `npm run script <name>` to run scripts from the `scripts/` folder:

- `npm run script migrate` – Run database migrations
- `npm run script patch-db` – Apply manual constraints & triggers
- `npm run script seed` – Seed database with test data

## ⚡ Key Conventions (Summary)

- **Imports**: ALWAYS use `@/` alias (e.g., `import ... from "@/configs/db"`).
- **Env Vars**: NEVER use `process.env`. Use `import variables from "@/configs/env"`.
- **Logging**: NEVER use `console.log`. Use `import logger from "@/configs/logger"`.
- **Database**: Use `dbClient.db` from `@/configs/db`.
- **Caching**: Use `redisCacheEarlyReturn` middleware + `redisClient.setResponseCache()`.
- **Validation**: Use Zod schemas and validation middleware. Access data via `req.Body`, `req.Query`.
- **Error Handling**: Throw `ApiError` and let the global error handler catch it.
- **Background Jobs**: Use pg-boss via `@/configs/jobs/dispatcher` for async tasks.

## 📁 Key Directories

| Path                  | Purpose                                                 |
| --------------------- | ------------------------------------------------------- |
| `configs/`            | Database, Redis, logger, jobs, OAuth, WebSocket configs |
| `configs/jobs/`       | pg-boss dispatcher and worker definitions               |
| `shared/services/`    | Business logic services                                 |
| `shared/middlewares/` | Auth, validation, caching middlewares                   |
| `shared/jobs/`        | Job type definitions and worker implementations         |
| `features/api/`       | API route handlers                                      |
| `scripts/`            | Utility scripts (migrate, seed, patch-db)               |

Refer to the `README.md` and `docs/` for more details.
