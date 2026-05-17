# Finance Committee Workspace Pass

## Status
Implemented as the second committee workspace pass at `/dashboard/workspaces/finance`.

## Core Tabs
- Overview: monthly finance obligations, recent dues activity, budget alerts, and pending approvals.
- Workbench: quick actions for dues review, sponsor/payment follow-up, and budget preparation.
- Budgets: generated finance position, active-program budget review, and CSV export.
- Dues: read-only dues catalogue and finance metrics for members; policy and offline-payment tools for the chair.
- Reports: backend-generated finance reports plus required beginning-of-month plan and end-of-month report submissions.
- People: committee members and chair visibility.

## Role Behavior
- Chair: submit monthly plan/report, prepare budgets, update finance outcomes, view exports, and manage finance workflow items.
- Member: view all workspace tabs, add notes, review non-sensitive summaries, and contribute comments without changing finance records.
- Super admin: full override plus access to all submitted finance plans/reports from the admin reports page.
- Non-member/non-chair: blocked by workspace authorization.

## Backend Work
- Reuse the workspace submissions and notes tables created for Programs & Records.
- Add generated finance report data from dues, donations, shop/order payments, and budget records once budget tables are introduced.
- Keep committee role assignment super-admin-only through `/committees/:id/enroll` and `/committees/:id/unenroll`.

## Test Plan
- Finance chair can submit monthly plan/report by typing or attaching a document link.
- Finance member can view reports and notes, but cannot submit official monthly documents or mutate finance records.
- Super admin can view Finance submissions in `/dashboard/admin/reports`.
- All workbench links remain inside `/dashboard/workspaces/finance/*`.

## Next Committee Candidate
Human Resource Management should be next because it owns applications, onboarding, volunteer placement, and member records. The workspace should keep application review, people handoff, onboarding checks, and monthly HR reporting inside `/dashboard/workspaces/hr/*`.
