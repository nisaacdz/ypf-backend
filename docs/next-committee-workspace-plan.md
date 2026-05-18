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

## Status
Implemented as the seventh committee workspace pass at `/dashboard/workspaces/sponsorship`.

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

# Legal Committee Workspace Plan

## Next Committee Candidate
Legal should follow Sponsorship because partner commitments now surface agreement status, legal review states, and contract handoffs. Legal needs a self-contained workspace for contracts, policies, compliance obligations, risk reviews, privacy/data guidance, and sponsorship agreement clearance.

## Goal
Build `/dashboard/workspaces/legal` as the next self-contained committee workspace so the Legal chair can manage agreements, policies, compliance obligations, risk reviews, privacy/data guidance, and cross-committee legal clearances without sending users to `/dashboard/admin/*`, `/dashboard/directory/*`, or another committee workspace.

Legal members should be able to view all Legal tabs, read attached documents, contribute review notes, and update non-final review progress where allowed. Final clearance, rejection, archival, official monthly submissions, and legal decision states remain chair/admin actions.

## Core Tabs
- Overview: legal workload, active contract reviews, open policy revisions, compliance due dates, risk review count, and monthly plan/report status.
- Workbench: legal operating dashboard for contracts, policy review, compliance watch, risk queue, privacy/data issues, and Sponsorship handoffs.
- Contracts: agreements, MOUs, sponsorship contracts, vendor terms, partnership terms, signatory status, review status, risk level, effective/expiry dates, and linked files.
- Policies: constitution/bylaws, internal policies, code of conduct, privacy terms, data retention guidance, disciplinary procedures, review cycles, version notes, and approval status.
- Compliance: statutory filings, regulatory obligations, governance deadlines, document renewals, board/executive obligations, owner, due date, and evidence.
- Risk Reviews: program risk, event consent, youth/safeguarding concerns, welfare escalations, data/privacy concerns, partner risk, mitigation notes, and final legal clearance.
- People: Legal chair and members.
- Reports: generated legal analytics plus required beginning-of-month plan and end-of-month report submissions.

## Supporting Routes
- `/dashboard/workspaces/legal/contracts`
- `/dashboard/workspaces/legal/policies`
- `/dashboard/workspaces/legal/compliance`
- `/dashboard/workspaces/legal/risks`
- Existing:
  - `/dashboard/workspaces/legal`
  - `/dashboard/workspaces/legal/workbench`
  - `/dashboard/workspaces/legal/people`
  - `/dashboard/workspaces/legal/reports`

## Workspace Divisions
1. Contracts, Agreements & Partnerships
   - Sponsorship contracts
   - Partnership agreements
   - MOUs
   - Vendor/service agreements
   - Signatory and renewal tracking
   - Finance/Sponsorship clearance notes

2. Policy, Governance & Internal Rules
   - Constitution and bylaws review
   - Code of conduct
   - Disciplinary policy
   - Volunteer/member policy
   - Privacy and data handling rules
   - Policy versioning and approval cycles

3. Compliance, Risk & Safeguarding
   - Statutory and governance obligations
   - Public website legal/privacy review
   - Program/event consent language
   - Youth, welfare, safeguarding, or sensitive-data risk
   - Risk mitigation and final clearance

## Core Functionality
- Create and track contract reviews with:
  - counterparty/partner
  - contract type
  - review status
  - risk level
  - owner
  - requested by committee
  - effective date
  - expiry/renewal date
  - agreement status
  - final clearance outcome
  - attached draft/signed documents
- Create and track policy records with:
  - policy area
  - current version
  - review status
  - approval state
  - next review date
  - owner
  - policy summary
  - change notes
  - attached policy documents
- Create and track compliance records with:
  - obligation name
  - category
  - due date
  - recurrence
  - owner
  - evidence requirement
  - status
  - attached evidence
- Create and track risk reviews with:
  - requesting committee
  - entity/program/event/partner
  - risk type
  - risk level
  - mitigation plan
  - clearance decision
  - deadline
  - Legal owner
  - final notes
- Upload and download local files for all Legal records:
  - draft agreements
  - signed contracts
  - policy PDFs/docs
  - compliance evidence
  - risk review attachments
- Export CSV from every Legal tab.
- Generate monthly Legal reports from structured workspace activity.
- Keep Sponsorship, Finance, Programs, HR, Welfare, Media, and Technical handoffs as Legal workspace records, not external navigation.

## Record Types
Persist first pass as typed workspace notes:
- `ypf.legal.record.v1`

Shared fields:
- `id`
- `kind`
- `area: "contracts" | "policies" | "compliance" | "risks"`
- `category`
- `title`
- `status`
- `priority`
- `owner`
- `requestedByCommittee`
- `riskLevel`
- `dueDate`
- `reviewDate`
- `expiryDate`
- `approvalState`
- `details`
- `outcome`
- `authorName`
- `createdAt`

Contracts-specific fields:
- `counterparty`
- `contractType`
- `agreementStatus`
- `effectiveDate`
- `renewalDate`
- `signatory`
- `financeHandoff`
- `sponsorshipHandoff`
- `signedDocumentUrl`
- `clauseNotes`

Policies-specific fields:
- `policyArea`
- `version`
- `appliesTo`
- `nextReviewDate`
- `changeSummary`
- `approvalBody`
- `publicationState`

Compliance-specific fields:
- `obligationType`
- `recurrence`
- `evidenceRequired`
- `evidenceStatus`
- `responsibleBody`
- `submissionDate`

Risk-specific fields:
- `requestingCommittee`
- `subject`
- `riskType`
- `mitigationPlan`
- `clearanceDecision`
- `clearanceDate`
- `safeguardingFlag`
- `privacyFlag`

## Status Models
Contracts:
- `REQUESTED`
- `TRIAGE`
- `DRAFT_REVIEW`
- `LEGAL_REVIEW`
- `CHANGES_REQUESTED`
- `CLEARED`
- `SIGNED`
- `EXPIRED`
- `BLOCKED`
- `ARCHIVED`

Policies:
- `DRAFT`
- `IN_REVIEW`
- `APPROVED`
- `PUBLISHED`
- `NEEDS_UPDATE`
- `RETIRED`
- `ARCHIVED`

Compliance:
- `OPEN`
- `IN_PROGRESS`
- `SUBMITTED`
- `VERIFIED`
- `OVERDUE`
- `WAIVED`
- `ARCHIVED`

Risk Reviews:
- `REQUESTED`
- `ASSESSING`
- `MITIGATION_REQUIRED`
- `CLEARED`
- `CLEARED_WITH_CONDITIONS`
- `REJECTED`
- `BLOCKED`
- `ARCHIVED`

## Role Behavior
- Legal chair:
  - create, edit, archive, export, and close Legal records
  - upload Legal files and evidence
  - mark contracts as cleared/signed
  - approve/publish policy records
  - verify compliance obligations
  - clear or reject risk reviews
  - submit monthly Legal plan/report
- Legal member:
  - view all Legal tabs
  - open details and attachments
  - upload supporting files where appropriate
  - add progress/context notes
  - update non-final draft/progress fields only if we later allow delegated editing
  - cannot clear, approve, reject, archive, delete, or submit official monthly documents
- Super admin:
  - full override
  - can view all Legal reports from admin reports
  - can assign Legal committee roles
- Regular admin:
  - workspace override according to existing admin-access behavior
- Non-member/non-chair:
  - blocked by existing workspace authorization

## Workbench Requirements
Legal workbench cards must stay inside Legal workspace:
- Contract reviews → `/dashboard/workspaces/legal/contracts`
- Policy library → `/dashboard/workspaces/legal/policies`
- Compliance watch → `/dashboard/workspaces/legal/compliance`
- Risk review queue → `/dashboard/workspaces/legal/risks`
- Monthly reports → `/dashboard/workspaces/legal/reports`

No Legal workbench card should navigate to:
- `/dashboard/admin/*`
- `/dashboard/directory/*`
- `/dashboard/me/*`
- another committee workspace

## Public Website Responsibility
Legal does not own public content presentation, but must review legal-sensitive public website surfaces:
- `/membership`: membership terms, declaration language, consent wording, privacy implications.
- `/volunteer`: volunteer declarations, consent, safeguarding language, and liability wording.
- `/donate`: donation disclaimers, restricted-fund wording, refund/legal notices with Finance.
- `/shop` and `/checkout`: purchase/refund terms, payment notices, fulfillment terms with Finance/Technical.
- `/contact`: privacy notice and routing consent with Media/Technical.
- `/projects` and `/events`: consent, media release language, safeguarding disclaimers, partner obligations.
- `/gallery`: image consent, safeguarding, and takedown procedure.
- Public policy/privacy pages if added later: Legal owns wording; Media owns presentation; Technical owns implementation.

## Cross-Committee Handoffs
- Sponsorship → Legal:
  - sponsorship agreement review
  - MOU review
  - partner obligations
  - contract risk and signatory readiness
- Finance → Legal:
  - restricted funds wording
  - expenditure/vendor agreement review
  - donation/refund terms
- Programs & Records → Legal:
  - event consent
  - program participation disclaimers
  - partner obligations in program delivery
- HR → Legal:
  - disciplinary policy
  - member conduct
  - application declarations and privacy
- Welfare → Legal:
  - sensitive welfare cases
  - safeguarding
  - confidentiality and escalation
- Technical → Legal:
  - data retention
  - privacy/security obligations
  - public website legal pages and cookies if introduced
- Media/Graphics → Legal:
  - consent for publication
  - brand/partner usage restrictions
  - public claims that need legal review

## Backend Work
- Reuse workspace submissions, notes, and attachments.
- Add `LEGAL_ALIAS = "legal"` if useful for named logic.
- Add `getLegalReportData(committeeId, monthStart, nextMonthStart)`.
- Parse `ypf.legal.record.v1` workspace-note payloads.
- Generated report metrics:
  - open contracts
  - active policies
  - compliance due/overdue
  - risk reviews awaiting clearance
  - cleared/signed outcomes
  - monthly Legal activity
- Report lists:
  - “Legal Review Queue”: open contracts, risk reviews, overdue compliance.
  - “Clearance Outcomes”: cleared contracts, signed agreements, published policies, verified compliance.
  - generated summary lines for overdue obligations, upcoming expiries, Legal/Sponsorship handoffs, and high-risk reviews.
- Keep official plan/report submissions through existing monthly submissions endpoint.

## Frontend Work
- Add `use-legal-workspace.ts`.
- Add `components/workspaces/legal/legal-record-workspace.tsx`.
- Add Legal routes:
  - `contracts/page.tsx`
  - `policies/page.tsx`
  - `compliance/page.tsx`
  - `risks/page.tsx`
- Update Legal tabs in workspace layout.
- Update `COMMITTEE_META.legal.workbench` to point to Legal workspace routes.
- Update generic report page labels so Legal gets:
  - Legal Review Queue
  - Clearance Outcomes
- Use `WorkspaceAttachments` inside Legal record detail/edit dialogs.
- Keep members in view mode with attachment visibility.
- Keep chair/admin actions visible and member destructive/final actions hidden.

## UI Behavior By Tab
Contracts:
- table columns:
  - agreement
  - counterparty
  - review status
  - risk level
  - effective/expiry date
  - signatory/owner
  - actions
- chair actions:
  - create contract review
  - update status
  - mark cleared/signed
  - attach draft/signed agreement
  - export CSV

Policies:
- table columns:
  - policy
  - version
  - applies to
  - review status
  - approval/publication state
  - next review
  - actions
- chair actions:
  - create policy record
  - update version notes
  - mark approved/published/retired
  - attach policy files
  - export CSV

Compliance:
- table columns:
  - obligation
  - category
  - due date
  - recurrence
  - evidence status
  - responsible body
  - actions
- chair actions:
  - create obligation
  - mark submitted/verified/waived
  - attach evidence
  - export CSV

Risk Reviews:
- table columns:
  - request
  - requesting committee
  - risk type
  - risk level
  - mitigation status
  - clearance decision
  - due date
  - actions
- chair actions:
  - create review
  - update mitigation
  - mark cleared/cleared with conditions/rejected
  - attach evidence
  - export CSV

## Test Plan
- Legal chair can access all Legal tabs.
- Legal member can access all Legal tabs but cannot see final/destructive actions.
- Non-Legal committee member cannot access `/dashboard/workspaces/legal/*`.
- Super admin can access Legal workspace and generated reports.
- Legal chair can create a contract review, attach a document, update status, export CSV, and see the report metrics update.
- Legal chair can create policy, compliance, and risk records.
- Report page is not “coming soon”; it shows generated Legal metrics and lists.
- All Legal workbench links stay under `/dashboard/workspaces/legal/*`.
- `npx tsc --noEmit` passes in `ypf-ums`.
- `npm run build` passes in `ypf-backend`.

## Implementation Order
1. Add Legal metadata and Legal-specific tabs/routes.
2. Add `use-legal-workspace.ts` for typed workspace-note records.
3. Build `LegalRecordWorkspace` with area-specific forms/tables.
4. Wire Contracts, Policies, Compliance, and Risk pages.
5. Add backend Legal report parsing and generated report data.
6. Update reports page labels for Legal queue/outcomes.
7. Verify chair/member/super-admin access and generated metrics.

# Records Management Committee Workspace Plan

## Next Committee Candidate
Records Management should follow Legal because the organization now has many operating committees producing evidence, agreements, applications, attendance, monthly submissions, certificates, financial evidence, welfare records, media assets, and program outcomes. Records Management should become the committee that turns those activities into reliable institutional memory.

## Organizational Role
The Records Management Committee is the custodian of YPF Africa’s official records. Its role is not just “keeping files”; it protects the organization’s memory, credibility, audit readiness, and continuity. The committee ensures that members, programs, events, certificates, documents, archives, and evidence are complete, findable, accurate, and properly handed off across committees.

Records Management should make sure that:
- every member has a clean and complete record
- every event/program has attendance and outcome evidence
- every certificate has an eligibility basis and issuance trail
- every important document is archived with owner, category, version, date, and retention status
- every committee’s monthly plan/report can be found later
- public website evidence such as gallery, programs, events, and impact reports are backed by real internal records
- leadership can trust the data used in dashboards, reports, awards, certificates, audits, and historical decisions

## Goal
Build `/dashboard/workspaces/records_mgmt` as a self-contained Records Management workspace where the chair can manage member record quality, attendance/evidence capture, certificate issuance tracking, document archives, retention reviews, and monthly records reports without sending users to `/dashboard/admin/*`, `/dashboard/directory/*`, or unrelated committee workspaces.

Members should view all Records Management tabs, inspect record queues, contribute notes, and upload supporting evidence. Final archive decisions, certificate issuance status, deletion/archive actions, and official monthly submissions remain chair/admin actions.

## Core Tabs
- Overview: record health, incomplete records, attendance gaps, certificate queue, archive workload, retention deadlines, and monthly plan/report status.
- Workbench: quick operating dashboard for member record quality, attendance gaps, certificate requests, archive intake, retention reviews, and cross-committee handoffs.
- Member Records: member profile completeness, public ID, contact data, chapter/committee/title assignment gaps, first-login/onboarding status, duplicates, and correction workflow.
- Attendance: program/event/meeting attendance capture, source event/program, participant count, missing attendance, verification status, and evidence attachments.
- Certificates: eligibility requests, certificate type, source program/event, recipient, attendance basis, approval status, issuance status, certificate ID/link, and reissue tracking.
- Archives: official documents, committee evidence, monthly submissions, legal/finance/program files, category, owner, retention class, version, and archive state.
- Retention: review dates, retention policy, expiry/disposal review, sensitive records, privacy/legal holds, and final disposition status.
- People: Records chair and members.
- Reports: generated records analytics plus required beginning-of-month plan and end-of-month report submissions.

## Supporting Routes
- `/dashboard/workspaces/records_mgmt/member-records`
- `/dashboard/workspaces/records_mgmt/attendance`
- `/dashboard/workspaces/records_mgmt/certificates`
- `/dashboard/workspaces/records_mgmt/archives`
- `/dashboard/workspaces/records_mgmt/retention`
- Existing:
  - `/dashboard/workspaces/records_mgmt`
  - `/dashboard/workspaces/records_mgmt/workbench`
  - `/dashboard/workspaces/records_mgmt/people`
  - `/dashboard/workspaces/records_mgmt/reports`

## Workspace Divisions
1. Member Records & Data Quality
   - member identity records
   - public ID quality
   - contact completeness
   - chapter/committee membership verification
   - title/role assignment integrity
   - duplicate and missing data follow-up
   - first-login and onboarding record readiness with HR

2. Attendance, Participation & Certification
   - event attendance records
   - program participation records
   - meeting attendance
   - attendance verification evidence
   - certificate eligibility
   - certificate issuance and reissue tracking
   - participation history for awards and leadership decisions

3. Archives, Evidence & Retention
   - official document archive
   - committee monthly submissions
   - signed agreements and policy documents from Legal
   - budget/receipt evidence from Finance
   - program/event outcome reports from Programs & Records
   - media/gallery evidence from Media and Graphics
   - retention/disposal review
   - privacy/legal hold coordination with Legal and Technical

## Core Functionality
- Create and track member record quality items:
  - member name/public ID
  - missing fields
  - duplicate suspicion
  - chapter/committee/title gap
  - source committee
  - correction owner
  - status and resolution notes
- Create and track attendance records:
  - event/program/meeting name
  - source committee
  - attendance date
  - expected attendees
  - recorded attendees
  - verification status
  - evidence files
  - missing attendance follow-up
- Create and track certificate records:
  - recipient/member
  - certificate type
  - source program/event
  - eligibility basis
  - approval state
  - issuance status
  - certificate ID/link
  - reissue reason
  - evidence attachments
- Create and track archive records:
  - document title
  - document category
  - source committee
  - owner
  - record date
  - version
  - confidentiality level
  - retention class
  - archive status
  - attachment files
- Create and track retention reviews:
  - record/archive item
  - retention rule
  - review date
  - sensitivity level
  - legal hold flag
  - privacy flag
  - disposition recommendation
  - final disposition status
- Export CSV from every Records Management tab.
- Allow local file upload/download through workspace attachments.
- Generate monthly records reports from typed workspace activity and existing member/program/event data.
- Keep all cross-committee handoffs represented as Records workspace records, not navigation into another committee’s workspace.

## Record Type
Persist the first pass as typed workspace notes:
- `ypf.records.record.v1`

Shared fields:
- `id`
- `kind`
- `area: "member_records" | "attendance" | "certificates" | "archives" | "retention"`
- `category`
- `title`
- `status`
- `priority`
- `owner`
- `sourceCommittee`
- `recordDate`
- `dueDate`
- `verificationStatus`
- `confidentiality`
- `details`
- `outcome`
- `authorName`
- `createdAt`

Member Records-specific fields:
- `memberName`
- `publicId`
- `memberEmail`
- `dataIssueType`
- `missingFields`
- `chapterStatus`
- `committeeStatus`
- `titleStatus`
- `duplicateRisk`
- `correctionAction`

Attendance-specific fields:
- `attendanceType`
- `sourceEntity`
- `eventOrProgramId`
- `attendanceDate`
- `expectedCount`
- `recordedCount`
- `missingCount`
- `attendanceSource`
- `evidenceStatus`

Certificates-specific fields:
- `recipientName`
- `recipientPublicId`
- `certificateType`
- `sourceProgramOrEvent`
- `eligibilityBasis`
- `approvalState`
- `issuanceStatus`
- `certificateId`
- `certificateUrl`
- `reissueReason`

Archives-specific fields:
- `documentCategory`
- `documentOwner`
- `documentDate`
- `version`
- `retentionClass`
- `archiveLocation`
- `legalHold`
- `privacyFlag`

Retention-specific fields:
- `archiveRecord`
- `retentionRule`
- `reviewDate`
- `sensitivityLevel`
- `dispositionRecommendation`
- `dispositionStatus`
- `approvedBy`
- `dispositionDate`

## Status Models
Member Records:
- `OPEN`
- `IN_REVIEW`
- `AWAITING_SOURCE`
- `CORRECTION_PENDING`
- `CORRECTED`
- `DUPLICATE_FLAGGED`
- `BLOCKED`
- `ARCHIVED`

Attendance:
- `PENDING`
- `IN_PROGRESS`
- `SUBMITTED`
- `VERIFIED`
- `MISSING_DATA`
- `RECONCILING`
- `CLOSED`
- `ARCHIVED`

Certificates:
- `REQUESTED`
- `ELIGIBILITY_REVIEW`
- `APPROVED`
- `ISSUED`
- `REISSUE_REQUESTED`
- `REJECTED`
- `BLOCKED`
- `ARCHIVED`

Archives:
- `INTAKE`
- `CLASSIFYING`
- `ARCHIVED`
- `NEEDS_METADATA`
- `UNDER_REVIEW`
- `RESTRICTED`
- `SUPERSEDED`
- `DISPOSED`

Retention:
- `SCHEDULED`
- `UNDER_REVIEW`
- `LEGAL_HOLD`
- `APPROVED_FOR_RETENTION`
- `APPROVED_FOR_DISPOSAL`
- `DISPOSED`
- `BLOCKED`
- `ARCHIVED`

## Role Behavior
- Records chair:
  - create, edit, archive, export, and close records
  - manage attendance verification workflows
  - approve certificate issuance status
  - classify archive records
  - manage retention review states
  - upload official documents and evidence
  - submit monthly records plan/report
- Records member:
  - view all tabs
  - inspect record quality queues
  - open details and attachments
  - upload supporting evidence
  - add notes and follow-up context
  - cannot delete, archive, dispose, approve certificate issuance, or submit official monthly documents
- Super admin:
  - full override
  - can view all records reports from admin reports
  - can assign Records committee roles
- Regular admin:
  - workspace override according to existing admin behavior
- Non-member/non-chair:
  - blocked by existing workspace authorization

## Workbench Requirements
Records Management workbench cards must stay inside Records workspace:
- Member record quality → `/dashboard/workspaces/records_mgmt/member-records`
- Attendance gaps → `/dashboard/workspaces/records_mgmt/attendance`
- Certificate queue → `/dashboard/workspaces/records_mgmt/certificates`
- Archive intake → `/dashboard/workspaces/records_mgmt/archives`
- Retention review → `/dashboard/workspaces/records_mgmt/retention`
- Monthly reports → `/dashboard/workspaces/records_mgmt/reports`

No Records workbench card should navigate to:
- `/dashboard/admin/*`
- `/dashboard/directory/*`
- `/dashboard/me/*`
- another committee workspace

## Public Website Responsibility
Records Management does not own public presentation, but it owns the internal evidence behind public claims:
- `/projects` and `/projects/:id`: program records, outcome evidence, attendance basis, completion archive.
- `/events`: event attendance, outcome evidence, participation records.
- `/gallery`: evidence metadata, consent/evidence archive with Media and Legal.
- `/membership`: approved member record completeness with HR.
- `/volunteer`: volunteer participation records with HR.
- `/certificates` if later public verification is added: certificate ID, recipient eligibility, issuance record, revocation/reissue state.
- Public impact statistics: Records validates source data before Media publishes claims.

## Cross-Committee Handoffs
- HR → Records:
  - approved member data
  - onboarding completion
  - role/chapter assignment evidence
  - first-login completion records
- Programs & Records → Records Management:
  - event attendance
  - program outcome reports
  - participant lists
  - certificate eligibility source
- Welfare → Records:
  - welfare outreach attendance/evidence
  - beneficiary support outcome archive with confidentiality controls
- Finance → Records:
  - approved budget evidence
  - receipt/expenditure archive
  - dues/payment record references when needed
- Legal → Records:
  - signed contracts
  - approved policies
  - compliance evidence
  - retention/legal hold requirements
- Media/Graphics → Records:
  - event photos and captions as evidence
  - approved design templates
  - campaign assets and public gallery source metadata
- Technical → Records:
  - data retention implementation
  - backup/export support
  - certificate/public verification support if added
- Executives/Management Board → Records:
  - minutes
  - decisions
  - official directives
  - governance approvals

## Backend Work
- Reuse workspace submissions, notes, and attachments.
- Add `RECORDS_MGMT_ALIAS = "records_mgmt"` if useful for named logic.
- Add `getRecordsManagementReportData(committeeId, monthStart, nextMonthStart)`.
- Parse `ypf.records.record.v1` workspace-note payloads.
- Report metrics:
  - open member data issues
  - attendance gaps
  - certificates pending
  - archive intake/review count
  - retention reviews due
  - verified/closed outcomes
- Generated report lists:
  - “Record Quality Queue”: open member records, missing attendance, certificate eligibility, archive metadata gaps.
  - “Verified Records & Archives”: corrected records, verified attendance, issued certificates, archived documents, disposed/retained records.
  - generated summary lines for high-priority issues, missing attendance, pending certificates, sensitive archives, and retention/legal-hold items.
- Optional future direct data sources:
  - Members table for profile completeness checks.
  - Events/Programs tables for missing attendance detection.
  - Certificates table for issued certificate counts.
  - Workspace monthly submissions for committee document archive completeness.

## Frontend Work
- Add `use-records-workspace.ts`.
- Add `components/workspaces/records/records-management-workspace.tsx`.
- Add routes:
  - `member-records/page.tsx`
  - `attendance/page.tsx`
  - `certificates/page.tsx`
  - `archives/page.tsx`
  - `retention/page.tsx`
- Update Records tabs in workspace layout.
- Update `COMMITTEE_META.records_mgmt.workbench` to point to Records workspace routes.
- Update reports page labels so Records gets:
  - Record Quality Queue
  - Verified Records & Archives
- Use `WorkspaceAttachments` inside Records detail/edit dialogs.
- Keep members in view mode with attachment visibility.
- Keep chair/admin actions visible and member destructive/final actions hidden.

## UI Behavior By Tab
Member Records:
- table columns:
  - member
  - issue type
  - missing fields
  - chapter/committee/title status
  - correction owner
  - status
  - actions
- chair actions:
  - create issue
  - update correction state
  - mark corrected/duplicate/block
  - attach evidence
  - export CSV

Attendance:
- table columns:
  - source event/program/meeting
  - attendance date
  - expected count
  - recorded count
  - missing count
  - verification status
  - actions
- chair actions:
  - create attendance record
  - update counts
  - mark submitted/verified/reconciling
  - attach attendance sheet/evidence
  - export CSV

Certificates:
- table columns:
  - recipient
  - certificate type
  - source program/event
  - eligibility basis
  - approval/issuance state
  - certificate ID/link
  - actions
- chair actions:
  - create certificate record
  - update eligibility status
  - mark approved/issued/reissue/rejected
  - attach certificate or evidence
  - export CSV

Archives:
- table columns:
  - document
  - source committee
  - category
  - version
  - confidentiality
  - retention class
  - archive state
  - actions
- chair actions:
  - create archive item
  - classify document
  - mark archived/restricted/superseded
  - attach file
  - export CSV

Retention:
- table columns:
  - archive record
  - retention rule
  - review date
  - sensitivity
  - legal/privacy hold
  - disposition recommendation
  - status
  - actions
- chair actions:
  - create retention review
  - mark legal hold
  - approve retention/disposal
  - record final disposition
  - attach supporting approval
  - export CSV

## Test Plan
- Records chair can access all Records tabs.
- Records member can access all Records tabs but cannot see destructive/final actions.
- Non-Records committee member cannot access `/dashboard/workspaces/records_mgmt/*`.
- Super admin can access Records workspace and generated reports.
- Records chair can create a member record issue, attendance record, certificate record, archive item, and retention review.
- Records chair can attach documents/evidence to each record type.
- Report page is not “coming soon”; it shows generated Records metrics and lists.
- Workbench links stay under `/dashboard/workspaces/records_mgmt/*`.
- `npx tsc --noEmit` passes in `ypf-ums`.
- `npm run build` passes in `ypf-backend`.

## Implementation Order
1. Add Records metadata and Records-specific tabs/routes.
2. Add `use-records-workspace.ts` for typed workspace-note records.
3. Build `RecordsManagementWorkspace` with area-specific forms/tables.
4. Wire Member Records, Attendance, Certificates, Archives, and Retention pages.
5. Add backend Records report parsing and generated report data.
6. Update reports page labels for Records queue/outcomes.
7. Verify chair/member/super-admin access and generated metrics.
