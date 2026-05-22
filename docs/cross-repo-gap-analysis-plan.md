# YPF Africa Cross-Repo Gap Analysis and Remediation Plan

Date: 2026-05-19

Repos reviewed:

- `ypf-backend` - Express API, PostgreSQL/Drizzle, Redis, pg-boss, payments, uploads, auth, workspaces.
- `ypf-ums` - Next.js dashboard/UMS used by admins, boards, committees, chapters, and members.
- `ypf-africa` - Public Vite website for membership, volunteer intake, donations, shop, projects, events, gallery, and contact.

This document captures the biggest gaps, mismatches, and production risks seen across the three repos, then gives a practical plan for fixing them in the right order.

## Executive Summary

The product has moved far beyond a simple website and dashboard. It now has public intake, payments, uploads, committee workspaces, reports, role-specific routing, and governance bodies. The main risk is not missing screens anymore; the main risk is that the three repos do not yet share one strict contract for auth, roles, env variables, API payloads, build rules, and production safety.

The most urgent blockers are:

1. `ypf-backend` does not currently build because of TypeScript errors in route param/query handling.
2. `ypf-ums` can build while hiding TypeScript errors because `next.config.mjs` sets `typescript.ignoreBuildErrors = true`.
3. `ypf-ums` login page exposes seeded demo/test credentials directly in the UI.
4. Public membership registration bypasses the shared public API client and hardcodes `VITE_API_URL`, while other public pages support `VITE_BACKEND_URL`.
5. Public membership registration sends arrays as `skills[]` and `missionPillars[]`, but the backend schema expects `skills` and `missionPillars`.
6. UMS still mixes old local role names with backend committee aliases and backend auth roles, which can cause sidebar/page/action permission mismatches.
7. Paystack webhook verification uses `JSON.stringify(req.body)` after `express.json()`, not the raw request body. This can fail signature validation in production.
8. Package management and env examples are inconsistent across repos, making production installs/deployments more fragile than they need to be.

## Current Build and Tooling Findings

### Backend Build Fails

Command run:

```bash
pnpm build
```

Result: failed.

Errors observed:

- `features/api/v1/applications/index.ts(64,11)` - route param `id` is treated as `string | string[]` instead of `string`.
- `features/api/v1/files/index.ts(20,38)` and `(24,49)` - route param `externalId` is treated as `string | string[]`.
- `features/api/v1/jobs/jobHandler.ts(88,66)`, `(121,50)`, `(148,50)` - `jobId`/`queue` values need narrowing or typed validated params.

Root cause:

- Some routes validate params into `req.Params`, but handlers still read from raw `req.params`.
- Express 5 typings make params/query wider than the target services accept.

Required fix:

- Prefer `req.Params.id`, `req.Params.externalId`, and typed query schemas after `validateParams` / `validateQuery`.
- For job routes, add `validateParams(z.object({ jobId: z.string().min(1) }))` and query validation for `queue`, or narrow safely before service calls.

### UMS Build Passes While Skipping Type Validation

Command run:

```bash
pnpm build
```

Result: passed, but with warning.

Important warning:

- Next skipped TypeScript validation because `next.config.mjs` contains:

```js
typescript: {
  ignoreBuildErrors: true,
}
```

Also observed:

- Next recommends TypeScript `>= 5.1.0`.
- Lockfile currently resolves `typescript@5.0.2`, while `package.json` says `"typescript": "^5"`.

Required fix:

- Upgrade/lock TypeScript to a modern version compatible with Next 16.
- Remove `ignoreBuildErrors`.
- Add a separate `typecheck` script and make it part of CI and pre-production checks.

### Public Website Build Passes With Warnings

Command run:

```bash
pnpm build
```

Result: passed.

Warnings observed:

- Package requires Node `20.x`, but local runtime was Node `v24.15.0`.
- `/grid.svg referenced in /grid.svg didn't resolve at build time`.
- Main JS chunk is large, and many images are over 1 MB.

Required fix:

- Use Node 20 in production, local dev, and CI.
- Confirm `/public/grid.svg` exists or remove the reference.
- Optimize public images and split heavy pages/components.

## Repo Structure and Dependency Gaps

### Package Manager Is Not Standardized

Observed:

- `ypf-backend` has `package-lock.json`, but also an untracked `pnpm-lock.yaml`.
- `ypf-africa` has both `package-lock.json` and `pnpm-lock.yaml`.
- `ypf-ums/.gitignore` ignores `pnpm-lock.yaml`, which makes PNPM installs less deterministic if that lockfile is not committed.
- Each repo is separate; there is no root workspace controlling all three together.

Risk:

- Developers and production may install different dependency versions.
- CI can pass in one repo and fail in another because the package manager contract is unclear.

Plan:

1. Choose one package manager for all three repos. Since current workflow uses `pnpm`, standardize on PNPM.
2. Commit one lockfile per repo, or create a root `pnpm-workspace.yaml` for all three.
3. Remove stale lockfiles from the package manager not being used.
4. Add `packageManager` to every `package.json`.
5. Pin Node versions with `.nvmrc` or Volta.

### Gitignore Has Production Readiness Issues

Observed:

- `ypf-africa/.gitignore` ignores `.env.example`.
- `ypf-backend/.gitignore` ignores `.github`.
- `ypf-ums` has no committed `.env.example`.
- `ypf-africa` has no committed `.env.example`.

Risk:

- New deployment setup is harder than necessary.
- CI workflows may be accidentally blocked from version control.
- Env contracts are documented unevenly across repos.

Plan:

1. Stop ignoring `.env.example`.
2. Add `ypf-ums/.env.example`.
3. Add `ypf-africa/.env.example`.
4. Allow `.github` if CI will live in repo.
5. Keep real `.env`, `.env.local`, and production secrets ignored.

## Environment Variable Mismatches

### Public Website Uses Two Different API Base Patterns

Shared public client:

- `ypf-africa/src/lib/api.ts` supports:
  - `VITE_BACKEND_URL`
  - fallback `VITE_API_URL`

Membership registration page:

- `ypf-africa/src/pages/MembershipRegistration.tsx` directly uses:
  - `${import.meta.env.VITE_API_URL}/api/v1/chapters`
  - `${import.meta.env.VITE_API_URL}/api/v1/committees`
  - `${import.meta.env.VITE_API_URL}/api/v1/applications/membership`

Risk:

- Production can set `VITE_BACKEND_URL` correctly and still have membership registration fail because that page requires `VITE_API_URL`.

Plan:

1. Route membership registration through `src/lib/api.ts`, or export one `apiBaseUrl` helper from there.
2. Standardize production public website env to:

```env
VITE_BACKEND_URL=https://api.your-domain.com
VITE_UMS_URL=https://ums.your-domain.com
```

3. Keep `VITE_API_URL` only as backward-compatible fallback, not as the primary documented variable.

### UMS Env Example Missing

Observed:

- `ypf-ums` uses `NEXT_PUBLIC_API_URL`, with fallback to `http://localhost:8000/api/v1`.
- No committed `.env.example` was found.

Plan:

Create:

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api/v1
```

Also document whether cookies are same-site across subdomains and make sure backend CORS/cookie settings match.

## Auth, Roles, and Access Control Gaps

### Demo Credentials Are Exposed in Login UI

Observed in `ypf-ums/app/(auth)/login/page.tsx`:

- Super admin email/password.
- General member email/password.
- Seeded committee chair/member credentials.

Risk:

- If deployed, anyone can see valid seeded accounts if they still exist in production.
- Even if the accounts do not exist, this is a bad production trust signal.

Plan:

1. Hide quick-fill test users behind a development-only check.
2. Ensure seeded test accounts are never created in production.
3. Add a backend seed guard that refuses test seeding unless `NODE_ENV !== "production"` or an explicit local flag is set.

### First Login Flow Is Split

Observed:

- `/auth/onboard` page uses the real backend onboarding OTP flow.
- Login page still contains a first-login password-change screen.
- `useAuth().updatePassword()` is a stub that returns `true` and does not call the backend.

Risk:

- A user can appear to update a password in the UI without the backend changing anything, depending on which path is used.
- Support/admin will struggle to explain the correct first-login flow.

Plan:

1. Make `/auth/onboard?user=...` the only first-login flow for approved members.
2. Remove the first-login modal from the normal login page, or make it redirect to `/auth/onboard`.
3. Replace the stubbed `updatePassword()` with a real call to `/auth/change-password` only for logged-in users.
4. Add integration/e2e tests for accepted application -> user created -> onboarding email/link -> OTP -> password set -> dashboard login.

### Legacy Role Names Still Drive UMS Permissions

Observed:

- UMS defines old roles such as:
  - `financial_committee_chair`
  - `digital_committee_chair`
  - `program_committee_chair`
  - `records_committee_chair`
- Backend committee aliases now include:
  - `finance`
  - `graphics`
  - `technical`
  - `programs_records`
  - `records_mgmt`
- UMS maps some aliases back to legacy roles, e.g. `graphics_committee_chair -> digital_committee_chair`.
- Many pages still use `user.role`, `RoleGuard`, `MODULE_ACCESS`, `canEdit`, or role strings instead of backend-derived `authRoles`, `profiles`, `committeeChairOf`, and `committeeMemberOf`.

Risk:

- Sidebar visibility, page access, and action buttons can disagree.
- A chair may be blocked from a page they should manage.
- A member may see an action button the backend later rejects.
- Admin override behavior may be inconsistent across modules.

Plan:

1. Create one UMS permission adapter that consumes backend auth payload only:
   - `authRoles`
   - `profiles`
   - `committeeChairOf`
   - `committeeMemberOf`
   - `chapterLeadOf`
2. Keep legacy `UserRole` only as a display/backward-compatibility layer.
3. Replace route guards and action checks gradually:
   - dashboard sidebar
   - directory pages
   - admin users/committees
   - workspace tabs/actions
   - member pages
4. Add permission tests for:
   - super admin
   - regular admin
   - committee chair
   - committee member
   - general member
   - non-member.

### Committee Role Assignment Needs End-to-End Confirmation

Backend direction appears correct:

- Committee role assignment is protected by super-admin checks.

Remaining risk:

- UMS pages can still show/hide buttons using older `canEdit()` logic.
- UI can imply a non-super-admin can manage users/committee assignments, even if backend rejects it.

Plan:

1. Make role-assignment button visibility depend on `ADMIN.SUPER_ADMIN`.
2. Make the backend error message clear if a non-super-admin tries.
3. Add a focused test:
   - super admin can assign chair/member titles.
   - regular admin cannot.
   - committee chair cannot assign roles.
   - assignment modal only lists members of the selected committee.

## Public Website and Backend Contract Mismatches

### Membership Registration Array Fields May Not Parse

Public website sends:

```ts
submitData.append("skills[]", skill)
submitData.append("missionPillars[]", pillar)
```

Backend schema expects:

```ts
skills: z.array(z.string()).optional()
missionPillars: z.array(z.enum(MissionPillarValues)).optional()
```

Risk:

- HR may see membership applications but lose selected skills and mission pillars.

Plan:

Option A, preferred:

- Change the frontend to append repeated fields as `skills` and `missionPillars`.

Option B:

- Add backend preprocessing that normalizes `skills[]` -> `skills` and `missionPillars[]` -> `missionPillars`.

Also add a backend integration test using multipart form data from the real frontend shape.

### Membership Registration Has Extra/Unused Fields

Observed:

- Public form appends `preferredProfile`.
- Backend membership schema does not define `preferredProfile`.

Risk:

- Field is silently ignored by strict backend validation if unknown keys are stripped, or rejected if schema becomes strict later.
- Product expectations drift.

Plan:

1. Decide whether `preferredProfile` is real.
2. If real, add it to backend schema/service/database/reporting.
3. If not real, remove it from public form state and submission.

### File Upload Error Text Is Wrong

Observed:

- Registration file schema uses `AllowedDocumentsMimeTypes`.
- Error message says only `PNG, JPG, MP4, or AVI` are allowed.

Risk:

- Applicants uploading PDF/DOC/DOCX can receive confusing feedback.

Plan:

- Update the error message to match the real allowed document/photo types.

### Public Website Ownership Source Has Minor Route Drift

Observed:

- UMS ownership map says gallery source is `GET /media`.
- Public website uses `/media/public`.
- Backend route is `/api/v1/media/public`.

Risk:

- Not a runtime bug, but it weakens internal documentation and public ownership accuracy.

Plan:

- Update ownership metadata to `GET /media/public`.

## Payments and Webhook Gaps

### Paystack Signature Verification Should Use Raw Body

Observed:

- `configs/server.ts` applies `express.json()` globally before `/api/v1`.
- `verifyPaystackSignature` computes HMAC over `JSON.stringify(req.body)`.

Risk:

- Paystack signs the raw request body. Re-stringifying parsed JSON can change whitespace/key serialization and cause valid production webhooks to fail.

Plan:

1. Mount Paystack webhook with a raw body parser before JSON parsing, or use `express.json({ verify })` to store `req.rawBody`.
2. Compute HMAC over the raw body buffer/string.
3. Add a webhook signature integration test using a known payload and expected signature.

### Payment Provider Tests Are Not Complete

Observed:

- Some Paystack integration tests are skipped/commented to avoid real provider calls.
- Provider abstraction exists, but contract tests should be stronger.

Plan:

1. Mock Paystack provider in tests.
2. Test donation initiate -> transaction created.
3. Test dues payment initiate -> transaction created.
4. Test shop checkout -> order and transaction created.
5. Test webhook success -> transaction/order status updates exactly once.
6. Test transaction verify fallback.

## Upload and Media Gaps

### MOV/iPhone Upload MIME Support Is Incomplete

Observed:

- Media MIME types include `video/mov`.
- Common browser MIME for MOV is `video/quicktime`.

Risk:

- Media/graphics users may fail uploading iPhone event clips.

Plan:

- Add `video/quicktime` to allowed media MIME types if the storage and rendering pipeline supports it.

### Upload Limits Need Deployment Alignment

Observed:

- Media upload limit is 250 MB.
- Document upload limit is 10 MB in middleware, but registration file schema limits to 5 MB.

Risk:

- Reverse proxy/serverless limits can reject files before Express sees them.
- User-facing limit may differ from backend/middleware limit.

Plan:

1. Decide final limits for:
   - public registration documents/photos
   - workspace attachments
   - media/gallery uploads
   - templates/assets
2. Align:
   - frontend validation
   - backend schema
   - multer limits
   - Nginx/proxy upload limits
   - Azure Blob policy.

## Workspace and Committee Functionality Gaps

### Some Workspace Features Are Stored as JSON Notes

The current workspace model is useful and flexible, but many committee-specific tabs are still implemented as typed records inside `workspace_notes` JSON.

Risk:

- Harder reporting and auditing for high-value domains.
- Harder to enforce lifecycle rules, approvals, ownership, and uniqueness.
- Harder to query performance as records grow.

Plan:

Keep notes for comments, discussion, and light records. Promote critical workflows to first-class tables:

- budgets and budget reviews
- monthly plans and monthly reports
- legal contracts and compliance obligations
- sponsorship commitments
- welfare cases
- HR applications/onboarding/evaluations
- technical incidents/releases
- governance approvals/directives/decisions.

### HR Workbench Links Hidden Tabs

Observed:

- HR tabs hide `applications`, `onboarding`, and `people` as requested earlier.
- HR workbench still links to `/dashboard/workspaces/hr/applications`.

Risk:

- Hidden tab does not mean inaccessible page.
- This may be intentional for workbench-only access, but it should be explicit.

Plan:

- Decide the rule:
  - remove all HR application/onboarding links from HR workspace; or
  - keep as workbench-only but not top-level tabs.
- If kept, ensure HR chair/member permissions are exactly right.

### Workbench Route Containment Needs Automated Check

Goal from earlier work:

- Committee users should stay inside their workspace.

Risk:

- New workbench cards can accidentally link to `/dashboard/admin/*`, `/dashboard/directory/*`, or `/dashboard/me/*`.

Plan:

1. Add a small static test/lint script that scans `COMMITTEE_META` workbench hrefs.
2. Fail if a committee workbench href does not start with `/dashboard/workspaces/{alias}` unless it is explicitly whitelisted.

## Reports Gaps

Observed:

- Reports now exist for many workspaces, but report quality depends on available domain data.
- Some pages generate report content from notes and monthly submissions.
- Super-admin/all-committee reporting exists conceptually, but should be validated against real use cases.

Risk:

- Reports can appear "working" but not answer leadership questions.
- Chair/member/admin report views can diverge.

Plan:

Define report contracts per audience:

### Committee Chair Report

- monthly plan submitted
- monthly report submitted
- pending actions
- completed actions
- blocked actions
- budget requests
- attachments/evidence
- people/activity summary.

### Committee Member Report

- read-only workspace summary
- assigned tasks/notes
- participation records
- submitted contributions.

### Super Admin Report

- all committee monthly plans/reports
- missing submissions
- overdue reviews
- budgets awaiting review
- role assignment audit
- activity by committee
- exportable CSV/PDF.

Then add tests to ensure every committee has:

- overview report data
- report page access for chair, member, admin, super admin
- blocked access for unrelated users
- monthly plan/report submission.

## API Contract and Type Safety Gaps

### No Shared Generated API Contract

Observed:

- Frontends manually define types and response assumptions.
- Backend uses Zod/Drizzle DTOs.
- Public and UMS clients each have their own API wrappers.

Risk:

- Backend can change a response shape and frontends compile.
- Frontend can send a payload backend rejects.

Plan:

1. Generate OpenAPI from backend routes/schemas or maintain an explicit OpenAPI spec.
2. Generate TypeScript clients/types for:
   - UMS
   - public website.
3. Add contract tests for:
   - membership application multipart
   - volunteer application
   - login/onboarding
   - workspace access/reporting
   - payments
   - uploads.

## Testing Gaps

Backend:

- Has integration tests for auth, committees, dues, partnerships, projects, chapters, members, and users.
- Needs tests for newer workspace/governance/media/upload/report/payment webhook paths.

UMS:

- No clear frontend test suite found.
- Build currently skips type validation.

Public website:

- No clear frontend test suite found.
- Needs form submission and payment-flow e2e coverage.

Plan:

1. Backend:
   - fix build
   - add workspace route tests
   - add webhook raw signature test
   - add membership multipart test matching real public form
2. UMS:
   - add typecheck
   - add Playwright smoke tests for login, sidebar, workspaces, role gates
3. Public:
   - add Playwright tests for membership, volunteer, donation, shop checkout, contact
4. Cross-repo:
   - run backend + UMS + public together in CI using test DB/Redis.

## Performance and Production UX Gaps

Public website:

- Large JS chunk.
- Large images.
- Missing/uncertain `grid.svg`.

UMS:

- Very broad dashboard surface; no explicit route-level performance checks.

Plan:

1. Public:
   - convert oversized images to WebP/AVIF where possible
   - lazy-load heavy sections
   - split shop/gallery/project detail bundles
   - confirm public assets referenced by CSS exist
2. UMS:
   - keep heavy workspace components route-scoped
   - avoid loading all committee data globally
   - add loading/error/empty states consistently.

## Security and Privacy Gaps

High-priority items:

- Remove seeded credentials from production UI.
- Remove auth payload console logs from UMS.
- Ensure Paystack webhook uses raw body signature verification.
- Ensure real env files are never committed.
- Ensure CORS `ALLOWED_ORIGINS` includes only real production domains.
- Ensure cookie options work across API/UMS domains.
- Ensure public application draft data in `localStorage` is cleared after success and does not persist sensitive documents.

Medium-priority items:

- Add audit logs to sensitive admin operations:
  - role assignment
  - committee leadership changes
  - membership approval/rejection
  - budget approval/rejection
  - payment reconciliation changes
  - system maintenance changes.
- Add production rate limits per public endpoint:
  - contact
  - membership
  - volunteer
  - donation initiate
  - checkout initiate
  - auth/OTP.

## Prioritized Implementation Plan

### Phase 0 - Stabilize the Build

Goal: all three repos build honestly and reproducibly.

Tasks:

1. Fix backend TypeScript errors in:
   - `applications/index.ts`
   - `files/index.ts`
   - `jobs/jobHandler.ts`
2. Remove `ignoreBuildErrors` from UMS.
3. Upgrade/lock UMS TypeScript to a compatible version.
4. Add scripts:

```json
{
  "typecheck": "tsc --noEmit"
}
```

or the Next-compatible equivalent.

5. Standardize package manager and lockfiles.
6. Add env examples for UMS and public website.

Acceptance checks:

```bash
cd ypf-backend && pnpm build
cd ypf-ums && pnpm build
cd ypf-africa && pnpm build
```

All must pass without hidden TypeScript failures.

### Phase 1 - Production Safety and Auth Cleanup

Goal: no production secrets/test logins/stubbed password flows.

Tasks:

1. Hide/remove seeded test login quick-fill in production.
2. Add production guard to seed scripts.
3. Remove auth console logs from UMS.
4. Remove or redirect login first-login modal.
5. Make onboarding the only approved-member first-login flow.
6. Replace stubbed `updatePassword()` with real `/auth/change-password` behavior or remove it.
7. Add onboarding e2e coverage.

Acceptance checks:

- Production login page shows no seeded credentials.
- Approved member can complete onboarding and then log in.
- Already-onboarded member cannot reuse onboarding.
- Password update changes backend password.

### Phase 2 - Align Public Website Contracts

Goal: all public forms and payments hit backend consistently.

Tasks:

1. Refactor membership registration to use shared public API base helper.
2. Fix `skills` and `missionPillars` multipart names or normalize backend parser.
3. Decide/remove/add `preferredProfile`.
4. Fix registration file error messages.
5. Add membership multipart integration test.
6. Add public Playwright test for membership submit.
7. Update public ownership source for gallery to `/media/public`.

Acceptance checks:

- Membership application captures all selected fields in HR.
- HR can view all submitted public website data.
- Public site works when only `VITE_BACKEND_URL` is set.

### Phase 3 - Harden Payments, Uploads, and Webhooks

Goal: money and files work reliably in production.

Tasks:

1. Change Paystack webhook verification to raw body.
2. Add webhook signature/idempotency tests.
3. Mock provider tests for Paystack flows.
4. Align upload MIME types and limits.
5. Add `video/quicktime` if supported.
6. Confirm Azure Blob production config and proxy upload limit.

Acceptance checks:

- Real Paystack webhook validates.
- Duplicate webhook does not duplicate fulfillment.
- Large allowed files upload successfully within documented limits.
- Rejected files show accurate user-facing errors.

### Phase 4 - Unify Roles and Workspace Authorization

Goal: sidebar, route guards, action buttons, and backend permissions all agree.

Tasks:

1. Create one UMS permission adapter using backend auth payload.
2. Replace legacy `RoleGuard` usage page by page.
3. Replace old `canEdit`, `canCreate`, `MODULE_ACCESS` checks with committee-aware permissions.
4. Add route/action tests for each major user type.
5. Add a workbench href containment check.

Acceptance checks:

- Chair can manage only their workspace scope unless admin.
- Member can view and participate but not perform destructive/core actions.
- Super admin can assign committee roles.
- Regular admin cannot assign committee roles if the rule is super-admin only.
- Workbench links do not take committee users out of their workspace unless explicitly approved.

### Phase 5 - Promote Critical Workspace Data Models

Goal: important committee workflows are not trapped in generic JSON notes.

Tasks:

1. Keep notes for collaboration and comments.
2. Promote critical workflows to first-class tables where needed:
   - monthly plans
   - monthly reports
   - budgets
   - governance approvals
   - legal contracts/compliance
   - welfare cases
   - technical incidents/releases
   - sponsorship commitments
3. Back reports with these tables instead of only JSON extraction.
4. Add exports for super admin and board review.

Acceptance checks:

- Every committee can submit monthly plan and report.
- Super admin can view all committee submissions.
- Chairs can attach documents/evidence.
- Reports are generated from durable, queryable data.

### Phase 6 - CI, Monitoring, and Production Operations

Goal: production becomes repeatable and observable.

Tasks:

1. Add CI for all repos:
   - install
   - lint
   - typecheck
   - build
   - backend tests
   - frontend smoke tests
2. Add dependency/security audit job.
3. Add deployment checklist.
4. Add health checks for:
   - DB
   - Redis
   - Azure Blob
   - SMTP
   - Paystack
   - pg-boss
5. Add backup and restore runbook.
6. Add production incident runbook.

Acceptance checks:

- No deploy without green build/typecheck.
- Health page reflects real dependency status.
- Backup restore is tested at least once before launch.

## Suggested Order for Our Next Work Sessions

1. Fix backend build errors.
2. Remove hidden UMS type errors by upgrading TypeScript and removing `ignoreBuildErrors`.
3. Remove production-dangerous login demo credentials and first-login stub.
4. Fix public membership API/env/array contract so HR captures everything.
5. Fix Paystack raw webhook verification.
6. Standardize env examples and lockfiles.
7. Start replacing legacy UMS role checks with backend-derived permissions.
8. Add smoke tests for the most important flows.

## Minimum Pre-Production Gate

Before going live, these must be true:

- `ypf-backend pnpm build` passes.
- `ypf-ums pnpm build` passes without ignoring TypeScript errors.
- `ypf-africa pnpm build` passes on Node 20.
- No seeded/test credentials are visible in production UI.
- Public membership registration works with production env variables.
- HR sees all membership/volunteer submitted fields.
- Paystack webhooks validate using raw body signatures.
- Committee role assignment is super-admin-only end to end.
- Committee chair/member/super-admin access has been manually verified for at least:
  - HR
  - Finance
  - Programs & Records
  - Media
  - Technical
  - Executives/Boards.
- All real secrets are configured only in production secret storage, not committed files.
