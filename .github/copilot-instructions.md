# GitHub Copilot Instructions for YPF Backend

This document provides context and guidelines for GitHub Copilot when working with the YPF Africa backend codebase.

## 📚 Documentation & Context

**Primary Sources of Truth:**

1. **`README.md`**: Setup, project structure, and key conventions.
2. **`docs/` folder**: Detailed implementation patterns (Authorization, Financial Transactions, etc.).
3. **Codebase**: Read `configs/`, `shared/services/`, and `features/` to understand the actual implementation.

**Tech Stack:**

- Node.js / Express / TypeScript
- PostgreSQL / Drizzle ORM
- Vitest (Testing)
- Zod (Validation)

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

## ⚡ Key Conventions (Summary)

- **Imports**: ALWAYS use `@/` alias (e.g., `import ... from "@/configs/db"`).
- **Env Vars**: NEVER use `process.env`. Use `import variables from "@/configs/env"`.
- **Database**: Use `dbClient.db` from `@/configs/db`.
- **Validation**: Use Zod schemas and validation middleware. Access data via `req.Body`, `req.Query`.
- **Error Handling**: Throw `ApiError` and let the global error handler catch it.

Refer to the `README.md` and `docs/` for more details.
