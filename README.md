# YPF Core Backend

Hey there! Welcome to the YPF Core backend. This guide will get you up to speed on our conventions and how we build things around here.

## 🚀 Getting Started

Getting it up and running is straightforward:

1.  Install the dependencies:
    ```sh
    npm install
    ```
2.  Reach out for the `env`'s.
4.  Start the dev server:
    ```sh
    npm run dev
    ```

And you're all set!

## 🏗️ How We Build: Key Conventions

This is the important part. To keep our codebase consistent and easy to navigate, we follow these rules:

*   **Path Aliases**: Always use the `@/` alias for imports from the project root (e.g., `import db from "@/configs/db";`). No more `../../..` madness.
*   **Environment Variables**: Never use `process.env` directly. Import the sanitized `variables` object from [`@/configs/env`](configs/env.ts).
*   **API Structure**:
    *   Routes and their handlers live in `features/api`.
    *   Handlers should be lean. They take in necessary data (not the whole `req`, `res` objects), call services, and return a structured `ApiResponse`.
    *   Services (`shared/services/`) contain the actual business logic, database interactions, and error handling.
*   **Validation**: After using the `validateBody` middleware, the validated data is available on `req.Body` (capitalized).
*   **Error Handling**: Services should handle potential errors and rethrow them as `AppError` from [`@/shared/types`](shared/types/index.ts).

## 🗺️ Project Layout

Here’s a quick look at the project structure:

-   `server.ts`: The main application entry point.
-   `configs/`: Project-wide configs (database connection, emailer, environment variables).
-   `db/`: All things Drizzle ORM – schema definitions and migration files.
-   `features/`: Contains API routes and handlers, organized by domain.
-   `shared/`: Reusable pieces of code like services, middlewares, and type definitions.
-   `scripts/`: Standalone utility scripts

If you have any questions, don't hesitate to ask!