# YPF App Backend

A YPF Africa backend setup

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

To keep our codebase consistent and easy to navigate, we follow these rules:

- Always use the `@/` alias for imports from the project root (e.g., `import dbClient from "@/configs/db";`).
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

Swagger UI

Served at /docs endpoint

---

## 🗺️ Project Layout

Here’s a quick look at the project structure:

- `app.ts` – Main application entry point.
- `configs/` – Project-wide configs (database connection, emailer, environment variables).
- `db/` – schema definitions and migrations.
- `docs/` – Some info regarding design patterns, implementation choices, etc.
- `features/` – Contains API routes, WebSocket handlers.
- `shared/` – Reusable code like services, middlewares, and type definitions.
- `scripts/` – Standalone utility scripts (run with `npm run script -- -- <scriptname>`).
- `tests/` – For tests.

---

If you have any questions, don’t hesitate to ask!
