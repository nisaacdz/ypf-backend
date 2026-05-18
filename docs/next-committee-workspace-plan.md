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

# Human Resource Management Workspace Plan

## Status
Implemented as the third committee workspace pass at `/dashboard/workspaces/hr`.

## Goal
Build the HR workspace as the third committee pass at `/dashboard/workspaces/hr`, keeping every HR duty inside the workspace. Chairs get full HR operations access. HR members can view assigned queues, people summaries, and reports, but cannot approve, reject, assign roles, or mutate member records.

## Proposed Tabs
- Overview: HR workload, pending applications, onboarding health, new members this month, and monthly plan/report status.
- Workbench: quick actions for application review, onboarding follow-up, volunteer placement, and people handoff.
- Recruitment: recruitment, orientation, member integration, and database-management action records.
- Performance: attendance, participation, executive evaluation, welfare, discipline, and engagement action records.
- Development: training, mentorship, leadership, succession, recognition, and growth opportunity action records.
- Reports: generated HR analytics plus required beginning-of-month plan and end-of-month report submissions.

## Supporting Workspace Routes
- Applications: `/dashboard/workspaces/hr/applications`, linked from Recruitment and Workbench, not shown as a top-level tab.
- Onboarding: `/dashboard/workspaces/hr/onboarding`, linked from Recruitment and Workbench, not shown as a top-level tab.
- People: `/dashboard/workspaces/hr/people`, linked from Performance and Workbench, not shown as a top-level tab.

## HR Operating Divisions
- Recruitment, Membership & Onboarding: recruitment, orientation, member integration, and database management.
- Performance, Welfare & Accountability: attendance and participation, executive evaluations, welfare and conflict resolution, discipline, and engagement tracking.
- Capacity Building & Organizational Development: trainings and mentorship, leadership development, succession planning, volunteer recognition, and growth opportunities.

## Role Behavior
- HR chair: review applications, approve or reject, submit monthly plan/report, manage onboarding tasks, and export HR records.
- HR member: view all HR tabs, open application/onboarding details, add notes where supported, and track queue status without making final decisions.
- Super admin: full override access and can view all HR plans/reports from admin reports.
- Non-member/non-chair: blocked by existing workspace authorization.

## Backend Work
- Reuse existing application services first, but expose HR workspace-scoped endpoints so the UI never links to `/dashboard/directory/registrations`.
- Add workspace notes on application/onboarding entities where needed.
- Persist HR division records as structured workspace notes and allow workspace chairs/admins to update them.
- Keep role assignment super-admin-only; HR can recommend placement but not assign committee/chapter roles unless already allowed by super admin.
- Generate HR report data from applications, accepted/rejected counts, onboarding completion, and new member activity.

## Test Plan
- HR chair can view and review application queues from `/dashboard/workspaces/hr/applications`.
- HR member can view queues/details but cannot approve, reject, or mutate records.
- All HR workbench actions remain under `/dashboard/workspaces/hr/*`.
- Super admin can view HR generated reports and HR monthly submissions.
- Unauthorized committee user cannot access `/dashboard/workspaces/hr/*`.

# Welfare Committee Workspace Pass

## Status
Implemented as the fourth committee workspace pass at `/dashboard/workspaces/welfare`.

## Goal
Build the Welfare workspace at `/dashboard/workspaces/welfare` so the chair can manage care cases, welfare initiatives, beneficiaries, event support, and monthly welfare reports without sending the committee into admin, directory, or personal pages. Members should view and contribute notes, while final case decisions and official submissions remain chair/admin actions.

## Proposed Tabs
- Overview: welfare workload, open care cases, active support initiatives, upcoming welfare events, and monthly plan/report status.
- Workbench: operating dashboard for urgent support, beneficiary follow-up, outreach planning, and cross-committee handoffs.
- Cases: member welfare/support requests, priority, category, confidentiality level, status, owner, resolution notes, and finance/HR handoff flags.
- Beneficiaries: people or groups receiving support, assistance history, needs, follow-up dates, and outcome status.
- Outreach: welfare programs/events, care desk assignments, distribution plans, logistics, and post-event follow-up.
- Reports: generated welfare analytics plus required beginning-of-month plan and end-of-month report submissions.

## Core Functionality
- Create and track welfare cases with status: open, assessing, escalated, resolved, blocked.
- Categorize cases: emergency support, mental health, financial hardship, conflict support, member care, beneficiary support, other.
- Assign an owner and follow-up date for every case.
- Add structured notes and outcome reports to cases and beneficiaries.
- Track beneficiary support history and pending needs.
- Link welfare activity to monthly plans and reports automatically.
- Export case and beneficiary summaries as CSV.
- Keep all external handoffs represented as workspace records, not navigation to another committee workspace.

## Role Behavior
- Welfare chair: create/update/close cases, manage beneficiaries, submit monthly plan/report, export data, and mark handoffs.
- Welfare member: view tabs, add participation/context notes where supported, and update non-final follow-up details if allowed later.
- Super admin: full override and all committee report visibility.
- Non-member/non-chair: blocked by workspace authorization.

## Backend Work
- Reuse workspace submissions and notes for first pass.
- Persist cases, beneficiaries, and outreach as typed `ypf.welfare.record.v1` workspace-note payloads.
- Generate Welfare report data from active cases, urgent records, active beneficiaries, outreach plans, closed outcomes, and monthly notes.
- Future: notification hooks for urgent welfare cases and finance/HR handoff reminders.

## Test Plan
- Welfare chair can create, edit, resolve, and export cases inside `/dashboard/workspaces/welfare/*`.
- Welfare member can view all welfare tabs but cannot close cases or submit official monthly documents.
- Workbench actions stay inside `/dashboard/workspaces/welfare/*`.
- Super admin can view generated welfare reports and monthly submissions.
- Unauthorized committee user cannot access `/dashboard/workspaces/welfare/*`.

# Media and Content Committee Workspace Pass

## Status
Implemented as the fifth committee workspace pass at `/dashboard/workspaces/media`.

## Goal
Build the Media workspace at `/dashboard/workspaces/media` so the chair can manage content requests, publishing schedules, coverage tasks, campaign assets, and monthly media reports. Members should be able to view assignments, update progress where allowed, and contribute notes, while final publishing, archive, and official report submissions remain chair/admin actions.

## Proposed Tabs
- Overview: content workload, pending publishing tasks, active campaigns, upcoming coverage, and monthly plan/report status.
- Workbench: quick actions for content requests, coverage assignments, publishing review, asset handoffs, and campaign status.
- Requests: intake for content needs from other committees, requester, priority, due date, channel, status, and approval state.
- Calendar: planned posts, event coverage, campaign milestones, publishing channels, owners, and due dates.
- Assets: approved captions, links, media references, campaign files, and handoffs to Graphics or Programs & Records.
- Website: public website ownership map, route/function distribution to committees, and website review records.
- People: Media chair and committee members.
- Reports: generated media analytics plus required beginning-of-month plan and end-of-month report submissions.

## Core Functionality
- Chair can create, edit, approve, archive, and export media records.
- Chair can assign content owners, set publishing dates, and mark cross-committee handoffs.
- Members can view all tabs and update non-final progress notes where supported.
- Requests, calendar items, and assets remain under `/dashboard/workspaces/media/*`.
- Public website routes are distributed to the proper operating committees while Media owns public presentation, triage, and publishing quality.
- Reports are generated from structured workspace activity, not a coming-soon placeholder.

## Public Website Responsibility Distribution
- `/`, `/about`, `/services`: Media owns public narrative; Executives and Graphics support approvals and visuals.
- `/membership` and `/volunteer`: HR owns submissions, decisions, and onboarding; Media supports recruitment copy.
- `/projects`, `/projects/:id`, `/events`: Programs & Records owns public program/event data; Media supports storytelling and coverage.
- `/gallery`: Media owns gallery readiness, captions, and public evidence; Graphics and Programs & Records support assets and event context.
- `/donate`: Finance owns donation records and payment reconciliation; Media and Sponsorship support campaign presentation.
- `/shop`, `/checkout`, and order success: Finance owns product/payment records; Graphics and Media support product presentation.
- `/contact`: Media owns public triage; HR, Sponsorship, Legal, Welfare, and Technical receive routed inquiries.
- Public brand assets: Graphics owns visual production; Media requests and publishes approved assets.
- Public platform health: Technical owns uptime, integrations, payments, uploads, and deployment health.

## Backend Work
- Reuse workspace notes and monthly submissions for the first pass.
- Persist media requests, calendar items, assets, and website reviews as typed `ypf.media.record.v1` workspace-note payloads.
- Add generated media report data from request counts, due/publishing items, approved/published items, asset handoffs, website surfaces, and monthly activity.
- Future: connect social/channel analytics once the real publishing integrations exist.

## Test Plan
- Media chair can create, edit, approve, export, and submit monthly plan/report inside `/dashboard/workspaces/media/*`.
- Media member can view tabs and records but cannot approve/archive/publish official records.
- Workbench actions stay inside `/dashboard/workspaces/media/*`.
- Super admin can view generated Media reports and monthly submissions.
- Unauthorized committee user cannot access `/dashboard/workspaces/media/*`.

# Graphics Team Workspace Pass

## Status
Implemented as the sixth committee workspace pass at `/dashboard/workspaces/graphics`.

## Goal
Build `/dashboard/workspaces/graphics` so the Graphics chair can manage design requests, brand assets, templates, campaign visuals, and delivery approvals without leaving the workspace. Members should view all queues and update assigned progress, while final approval/archive actions remain chair/admin actions.

## Proposed Tabs
- Overview: design workload, pending requests, brand assets, templates, and monthly plan/report status.
- Workbench: quick actions for request intake, active designs, template library, brand review, and media handoffs.
- Requests: committee design requests, owner, due date, priority, status, and requesting committee.
- Brand: logos, palettes, usage notes, public-site visual rules, and approved templates.
- Templates: social, event, certificate, merchandise, sponsorship, and campaign template records.
- People: Graphics chair and committee members.
- Reports: generated graphics analytics plus required beginning-of-month plan and end-of-month report submissions.

## Backend Work
- Reuse workspace submissions and notes for the first pass.
- Persist design requests, brand assets, and templates as typed `ypf.graphics.record.v1` workspace-note payloads.
- Generate Graphics report data from open requests, brand assets, templates, urgent items, approved outputs, handoffs, and monthly activity.

## Test Plan
- Graphics chair can create, edit, approve, archive, export, and report on design records.
- Graphics member can view all tabs and contribute progress notes without final approval rights.
- Media can record handoffs to Graphics without leaving Media workspace.
- Reports are generated from typed graphics workspace activity.

# Sponsorship and Partnership Committee Workspace Plan

## Next Committee Candidate
Sponsorship should follow Graphics because public website fundraising, partner visibility, campaign visuals, and donation flows now have clear Media/Graphics/Finance ownership. Sponsorship needs a self-contained workspace for partner pipeline, sponsor packages, proposals, commitments, renewals, and Finance/Legal handoffs.

## Goal
Build `/dashboard/workspaces/sponsorship` so the chair can manage partner prospects, sponsorship packages, outreach history, commitment status, activation deliverables, and monthly partnership reporting. Members should view all tabs and update assigned outreach progress, while final commitment/close/archive actions remain chair/admin actions.

## Proposed Tabs
- Overview: partner pipeline, active opportunities, commitments, upcoming activation dates, and monthly plan/report status.
- Workbench: quick actions for partner intake, outreach, proposal drafting, legal/finance handoff, and campaign activation.
- Pipeline: prospects, stage, owner, category, value estimate, follow-up date, and next action.
- Packages: sponsorship tiers, benefits, target programs/events, media/graphics deliverables, and approval state.
- Commitments: pledged support, agreement status, finance handoff, legal review, delivery obligations, and renewal date.
- Reports: generated sponsorship analytics plus required beginning-of-month plan and end-of-month report submissions.

## Test Plan
- Sponsorship chair can create, edit, close, export, and report on partner records.
- Sponsorship member can view all tabs and update progress notes without final approval rights.
- Finance and Legal handoffs remain represented as Sponsorship workspace records.
- Reports are generated from typed sponsorship workspace activity.
