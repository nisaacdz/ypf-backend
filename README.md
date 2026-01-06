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
3. **Start the dev server**
   ```sh
   npm run dev
   ```

And you’re all set!

---

## 🏗️ How We Build: Key Conventions

To keep our codebase consistent and easy to navigate, we follow these rules:

- **Imports**: Always use the `@/` alias for imports from the project root (e.g., `import dbClient from "@/configs/db";`).
- **Environment**: Never use `process.env` directly. Import `variables` from [`@/configs/env`](configs/env.ts).
- **API Structure**:
  - Routes in `features/api`.
  - Handlers should be lean, calling **Services** (`shared/services/`) for logic.
  - **Utils** (`shared/utils/`) for domain-agnostic helpers.
  - Use validation middlewares (`validateBody`, etc.) and access typed data via `req.Body`, `req.Query`.

---

## 📚 Documentation

- **Swagger UI**: Served at `/docs` endpoint when the server is running.
- **API Documentation**: See [`swagger/README.md`](swagger/README.md) for details on the YAML-based Swagger documentation structure.
- **Implementation Guides**: Check the `docs/` folder for detailed implementation patterns (Transactions, Authorization, etc.).

---

## 🗺️ Project Layout

- `app.ts` – Main application entry point.
- `configs/` – Project-wide configs (database, emailer, env).
- `db/` – Schema definitions and migrations.
- `docs/` – Implementation patterns and workflows.
- `features/` – API routes and feature-specific logic.
- `shared/` – Reusable code (services, middlewares, types, utils).
- `scripts/` – Standalone utility scripts.
- `swagger/` – OpenAPI/Swagger documentation (YAML files).
- `tests/` – Unit and integration tests.

---

If you have any questions, don’t hesitate to ask!
