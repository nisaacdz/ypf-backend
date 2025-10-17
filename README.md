# YPF Core Backend

A modular and well-structured Express backend for YPF projects.  
This guide will get you up to speed on our conventions and how we build things around here.

---

## 🚀 Getting Started

Getting it up and running is straightforward:

1. **Install dependencies**
   ```sh
   npm install
   ```
2. Reach out for the `env`'s.
3. **Start the dev server**
   ```sh
   npm run dev
   ```

And you’re all set!

---

## 🏗️ How We Build: Key Conventions

This is the important part. To keep our codebase consistent and easy to navigate, we follow these rules:

- Always use the `@/` alias for imports from the project root (e.g., `import pgPool from "@/configs/db";`).
  No more `../../..` madness.

- Never use `process.env` directly.
  Instead, import the sanitized `variables` object from [`@/configs/env`](configs/env.ts).

- **API Structure**
  - Routes live in `features/api`.
  - Handlers (if you decide to extract route handler logic into a separate function) should be lean.
    They take in only necessary data (not the whole `req` and `res`), call services, and return a structured `ApiResponse`.
  - **Services (`shared/services/`)** perform database interactions, error handling, and other API-related logic.
  - **Utils (`shared/utils/`)** contain small, reusable helpers not tied to a specific domain — rely on your intuition when deciding between a service or a util.
  - After using helpers like `validateQuery`, `validateBody`, or `validateParams`, you can safely access the parsed and validated data via `req.Query`, `req.Body`, and `req.Params` respectively.

---

## 📚 Documentation

TODO

---

## 🗺️ Project Layout

Here’s a quick look at the project structure:

- `server.ts` – Main application entry point.
- `configs/` – Project-wide configs (database connection, emailer, environment variables).
- `db/` – All things [Drizzle ORM](https://orm.drizzle.team/): schema definitions and migrations.
- `docs/` – Currently empty.
- `features/` – Contains API routes, WebSocket handlers.
- `shared/` – Reusable code like services, middlewares, and type definitions.
- `scripts/` – Standalone utility scripts (e.g., `migrate.ts`, `seed.ts`).
- `tests/` – For tests.

---

If you have any questions, don’t hesitate to ask!
