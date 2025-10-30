# Codebase-Wide Review & Findings

This document outlines findings from a comprehensive review of the YPF Backend codebase. The items are tiered by priority, from critical issues to potential enhancements.

## Tier 1: High-Priority Issues & Inconsistencies

These are items that may represent bugs, violate established conventions, or require immediate attention.

- [ ] **Incomplete Schema Definition**: The `AdminRolesAssignments` table in [`db/schema/core.ts`](d:\workspace\ypf-backend\db\schema\core.ts) is marked with a `// TODO review Roles and Assignments`. This suggests the logic may be incomplete or unvalidated.
- [ ] **Missing `updatedAt` Fields**: Several core tables like [`Committees`](d:\workspace\ypf-backend\db\schema\core.ts) and [`Chapters`](d:\workspace\ypf-backend\db\schema\core.ts) lack an `updatedAt` timestamp field. This is inconsistent with tables like `FinancialTransactions` (as proposed in [`docs/0003_financial-transaction-api-research.md`](d:\workspace\ypf-backend\docs\0003_financial-transaction-api-research.md)) and is crucial for auditing and debugging.
- [ ] **Test Isolation Not Fully Implemented**: The design document [`docs/0001_test-isolation-strategy.md`](d:\workspace\ypf-backend\docs\0001_test-isolation-strategy.md) recommends database-level isolation, but integration tests (e.g., [`tests/integration/chaptersRoutes.ts`](d:\workspace\ypf-backend\tests\integration\chaptersRoutes.ts)) still perform manual cleanup (`pgPool.db.delete(...)`). This indicates the recommended test isolation strategy has not been fully implemented, risking test flakiness.
- [ ] **Inconsistent Service Layer Usage**: The `eventsHandler.ts` in [`features/api/v1/events/eventsHandler.ts`](d:\workspace\ypf-backend\features\api\v1\events\eventsHandler.ts) directly uses `pgPool` for some operations instead of abstracting all database logic into the corresponding service (`eventsService.ts`). This violates the API structure guidelines from [`.github/copilot-instructions.md`](d:\workspace\ypf-backend.github\copilot-instructions.md).

## Tier 2: Medium-Priority Simplifications & Refinements

These are opportunities to improve code quality, consistency, and maintainability.

- [ ] **Redundant Handler Logic**: Handlers like [`getChapters` in `chaptersHandler.ts`](d:\workspace\ypf-backend\features\api\v1\chapters\chaptersHandler.ts) are simple wrappers around a service call. This boilerplate can be reduced by creating a higher-order function that takes a service function and returns a standard Express handler.
- [ ] **Consolidate Media Utilities**: The project has `mediaUtils` in [`shared/utils/media.ts`](d:\workspace\ypf-backend\shared\utils\media.ts) and `mediaService` in [`shared/services/mediaService.ts`](d:\workspace\ypf-backend\shared\services\mediaService.ts). The distinction is unclear. For instance, `backfillVideoMetadata` in the service seems like a utility. Clarifying the separation of concerns or merging them would improve clarity.
- [ ] **Standardize DTO Naming**: There's a mix of naming conventions for Data Transfer Objects (DTOs), such as `YPFChapter` and `DetailedChapter` in [`shared/dtos/core.ts`](d:\workspace\ypf-backend\shared\dtos\core.ts). Adopting a consistent naming pattern (e.g., `ChapterSummaryDTO`, `ChapterDetailsDTO`) would make their purpose more explicit.
- [ ] **Centralize Pagination Logic**: Pagination logic (calculating offset, mapping results) is repeated in multiple services like [`chaptersService.ts`](d:\workspace\ypf-backend\shared\services\chaptersService.ts) and [`projectsService.ts`](d:\workspace\ypf-backend\shared\services\projectsService.ts). This could be extracted into a reusable utility function to reduce duplication and ensure consistency.

## Tier 3: Low-Priority Enhancements & Suggestions

These are long-term improvements for a more robust and scalable system.

- [ ] **Implement Soft Deletes**: Many tables use a hard delete (`onDelete: "cascade"`). For critical data like `Chapters` or `Committees`, using a soft-delete pattern (e.g., an `archivedAt` or `deletedAt` field) would be safer and allow for data recovery. The `Committees` table already has an `archivedAt` field which could be used for this.
- [ ] **Add Foreign Key for Media Uploader**: The `Medium.uploadedBy` field in [`db/schema/core.ts`](d:\workspace\ypf-backend\db\schema\core.ts) correctly references `Constituents.id`. However, the `onDelete` behavior is "set null". Consider if "restrict" would be a safer default to prevent accidental deletion of constituents who have uploaded media.
- [ ] **Refine File Validation**: The `validateFile` middleware in [`shared/middlewares/validate.ts`](d:\workspace\ypf-backend\shared\middlewares\validate.ts) checks the file's magic number against its MIME type, which is excellent. However, it could be enhanced to accept an array of allowed MIME types to be more flexible for different upload scenarios.
- [ ] **Improve Swagger Documentation**: The Swagger setup in [`configs/docs.ts`](d:\workspace\ypf-backend\configs\docs.ts) is functional but could be improved by auto-generating response schemas from Zod validators and DTO types, reducing manual schema definitions and ensuring documentation is always in sync with the code.
