# YPF Core Backend

This guide will get you up to speed on our conventions and how we build things around here.

## 🚀 Getting Started

Getting it up and running is straightforward:

1.  Install the dependencies:
    ```sh
    npm install
    ```
2.  Reach out for the `.env` variables.
3.  Start the dev server:
    ```sh
    npm run dev
    ```

And you're all set!

## 🏗️ How We Build: Key Conventions

This is the important part. To keep our codebase consistent and easy to navigate, we follow these rules:

- **Path Aliases**: Always use the `@/` alias for imports from the project root (e.g., `import pgPool from "@/configs/db";`). No more `../../..` madness.
- **Environment Variables**: Never use `process.env` directly. Import the sanitized `variables` object from [`@/configs/env`](configs/env.ts).
- **API Structure**:
  - Routes and their handlers live in `features/api`, organized by version and domain.
  - Handlers should be lean. They take in necessary data (not the whole `req`, `res` objects), call services, and return a structured `ApiResponse`.
  - Services (`shared/services/`) contain the actual business logic, database interactions, and error handling.
- **Database**: We use Drizzle ORM. Schema is defined in `db/schema/` and migrations are handled via `scripts/migrate.ts`.
- **Validation**: use the validation middlewares `validateBody`, `validateQuery`, `validateParams` with the expected zod schemas regularly.
- **Error Handling**: Services should handle potential errors and rethrow them as `AppError` from [`@/shared/types`](shared/types/index.ts).

## ✅ Testing

We use Vitest for our tests.

- **Setup**: Test files are in the `tests/` directory. The [`tests/setup.ts`](tests/setup.ts) file handles the test environment setup.
- **Running Tests**:
  ```sh
  npm test
  ```

## 📚 Documentation

## 🗺️ Project Layout

Here’s a quick look at the project structure:

- `server.ts`: The main application entry point.
- `configs/`: Project-wide configs (database connection, emailer, environment variables).
- `db/`: All things Drizzle ORM – schema definitions and migration files.
- `docs/`: Generated TypeDoc documentation.
- `features/`: Contains API routes and handlers, organized by domain.
- `shared/`: Reusable pieces of code like services, middlewares, and type definitions.
- `scripts/`: Standalone utility scripts (e.g., `migrate.ts`, `seed.ts`).
- `tests/`: Unit and integration tests.

If you have any questions, don't hesitate to ask!

## 🛠️ Tools We Use

- **Node.js**: JavaScript runtime for building the server.
- **Express**: Web framework for building APIs.
- **Zod**: TypeScript-first schema validation.
- **Drizzle ORM**: Type-safe database ORM.
- **Vitest**: Fast unit testing framework.
- **TypeDoc**: Documentation generator for TypeScript projects.
