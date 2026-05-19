# YPF App Backend

A YPF Africa backend setup.

---

## 🚀 Getting Started

Getting it up and running is straightforward:

1. **Install dependencies**
   ```sh
   npm install
   ```
2. **Configure Environment**
   Copy `.env.example` to `.env` and fill in the values.
   ```sh
   cp .env.example .env
   ```
3. **Run Database Migrations**
   ```sh
   npx drizzle-kit migrate
   ```
4. **Apply Database Constraints** (optional, for exclusion constraints & triggers)
   ```sh
   npm run script patch-db
   ```
5. **Seed Database** (optional, for development)
   ```sh
   npm run script seed
   ```
6. **Start the dev server**
   ```sh
   npm run dev
   ```

And you're all set!

---

## 🏗️ How We Build: Key Conventions

To keep our codebase consistent and easy to navigate, we follow these rules:

- **Imports**: Always use the `@/` alias for imports from the project root (e.g., `import dbClient from "@/configs/db";`).
- **Environment**: Never use `process.env` directly. Import `variables` from [`@/configs/env`](configs/env.ts).
- **Logging**: Use the Pino logger from `@/configs/logger` instead of `console.log`.
- **API Structure**:
  - Routes in `features/api`.
  - Handlers should be lean, calling **Services** (`shared/services/`) for logic.
  - **Utils** (`shared/utils/`) for domain-agnostic helpers.
  - Use validation middlewares (`validateBody`, etc.) and access typed data via `req.Body`, `req.Query`.
- **Caching**: Use `redisCacheEarlyReturn` middleware and `redisClient.setResponseCache()` for endpoint caching.
- **Background Jobs**: Use pg-boss via `configs/jobs/dispatcher.ts` for async tasks.

---

## 📚 Documentation

- **Swagger UI**: Served at `/docs` endpoint when the server is running.
- **API Documentation**: See [`swagger/README.md`](swagger/README.md) for details on the YAML-based Swagger documentation structure.
- **Production Setup**: See [`docs/production-environment-setup.md`](docs/production-environment-setup.md) for the full production env, deployment, DNS, storage, email, payment, and verification guide.
- **Implementation Guides**: Check the `docs/` folder for detailed implementation patterns (Transactions, Authorization, etc.).

---

## 🗺️ Project Layout

- `app.ts` – Main application entry point.
- `configs/` – Project-wide configs:
  - `db.ts` – Database client (Drizzle ORM)
  - `redis.ts` – Redis client for caching
  - `logger.ts` – Pino logger
  - `jobs/` – pg-boss job dispatcher and workers
  - `oauth/` – OAuth providers
  - `ws.ts` – WebSocket server (Socket.IO)
- `db/` – Schema definitions and migrations.
- `docs/` – Implementation patterns and workflows.
- `features/` – API routes and feature-specific logic.
- `shared/` – Reusable code:
  - `services/` – Business logic
  - `middlewares/` – Express middlewares (auth, validation, caching)
  - `jobs/` – Background job definitions and workers
  - `types/` – TypeScript types and DTOs
  - `utils/` – Utility functions
- `scripts/` – Standalone utility scripts:
  - `migrate.ts` – Run database migrations
  - `patch-db.ts` – Apply manual constraints & triggers
  - `seed.ts` – Seed database with test data
- `swagger/` – OpenAPI/Swagger documentation (YAML files).
- `tests/` – Unit and integration tests.

---

## 🔧 Available Scripts

| Command                 | Description                         |
| ----------------------- | ----------------------------------- |
| `npm run dev`           | Start dev server with hot reload    |
| `npm run build`         | Build for production                |
| `npm start`             | Run production build                |
| `npm run script <name>` | Run a script from `scripts/` folder |
| `npm test`              | Run tests                           |
| `npm run lint`          | Run ESLint                          |

---

If you have any questions, don't hesitate to ask!
