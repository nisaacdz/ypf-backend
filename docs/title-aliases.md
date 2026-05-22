# Title Aliases

Single source of truth for the **stable string codes** the backend and UMS use to identify committees, chapters, and titles. Display names (`title`, `name`) can change without breaking anything; aliases **must not** change once assigned, because they appear in JWT roles, URL paths, and authorizer guards.

## Committee aliases

Used as URL segments in the UMS (`/dashboard/workspaces/<alias>`) and as the `alias` column on `core.committees`.

| Alias | Display name | Notes |
| --- | --- | --- |
| `executives` | YPF Executives | Top-level executive leadership |
| `management_board` | Management Board | Governance, approvals, org direction |
| `advisory_board` | Advisory Board | Strategic advisors |
| `hr` | Human Resource Management Committee | Applications, title assignments |
| `legal` | Legal Committee | Contracts, compliance, policy |
| `finance` | Financial Committee | Transactions, donations, dues, expenditures |
| `welfare` | Welfare Committee | Welfare projects + beneficiaries |
| `media` | Media and Content Committee | Announcements, content calendar |
| `graphics` | Graphics Team | Brand assets, design requests |
| `records_mgmt` | Records Management Committee | Member directory, certificates, archives |
| `programs_records` | Programs and Records Committee | Programs, events, attendance |
| `sponsorship` | Sponsorship and Partnership Committee | Partner & sponsor relationships |
| `technical` | Technical Committee | Infrastructure, integrations, internal tooling |
| `institutional` | Institutional Committee | Oversees all chapters |

## Title aliases (per committee)

Every committee seeded by `scripts/seed-org-structure.ts` gets exactly two titles. To assign a constituent, create a `core.member_titles_assignments` row pointing at the right `member_titles.id`.

> **Important:** Title aliases carry their **type prefix** because the role string is constructed as `MEMBER.<alias>.<scopeId>`. A bare `chair` alias would produce `MEMBER.chair.<id>` which collides with chapter-scoped roles. Always prefix with the scope type (`committee` or `chapter`).

| Alias | Display | `_level` (boards) | `_level` (functional committees) |
| --- | --- | --- | --- |
| `committeechair` | Chair / Head | 0–10 | 20 |
| `committeemember` | Member | 10–20 | 40 |

> `_level` convention: lower number = more senior. Used for sorting and tie-breaking in the UI, not for permission checks (use role strings for that — see below).

## Chapter title aliases

Chapters live in `core.chapters` (separate from committees). Chapter titles use the same per-scope title pattern. Aliases also carry the `chapter` type prefix:

| Alias | Display | Notes |
| --- | --- | --- |
| `chapterlead` | Chapter Lead | Top role for a chapter |
| `chapterhead` | Chapter Head | Day-to-day operations |
| `chaptermember` | Chapter Member | General chapter member |

> Chapter titles are **not** seeded by `seed-org-structure.ts`. They're created per-chapter as chapters are spun up.

## Role-string grammar (used in JWT `roles` array + `Visitors.hasRole`)

Built by helpers in [`configs/authorizer/roles.ts`](../configs/authorizer/roles.ts):

| Role string | Built by | Meaning |
| --- | --- | --- |
| `MEMBER.president` | `MEMBER.PRESIDENT` (static) | YPF President |
| `MEMBER.treasurer` | `MEMBER.TREASURER` (static) | YPF Treasurer |
| `MEMBER.chapterlead.<chapterId>` | `MEMBER.chapterLead(id)` | Lead of a specific chapter |
| `MEMBER.chapterhead.<chapterId>` | `MEMBER.chapterHead(id)` | Head of a specific chapter |
| `MEMBER.committeechair.<committeeId>` | `MEMBER.committeeChair(id)` | Chair of a specific committee |
| `MEMBER.committeemember.<committeeId>` | `MEMBER.committeeMember(id)` | Member of a specific committee |
| `ADMIN.SUPER_ADMIN` | `ADMIN.SUPER` | Super admin |
| `ADMIN.REGULAR_ADMIN` | `ADMIN.REGULAR` | Regular admin |

The role strings use `committeeId`/`chapterId` (UUIDs), **not** aliases. Aliases are for URL routing and display; UUIDs are for access control. The mapping from alias → UUID happens at request boundary (resolve alias to committee row, then check roles against `committee.id`).

## Adding a new committee

1. Add a new row to the `COMMITTEES` array in [`scripts/seed-org-structure.ts`](../scripts/seed-org-structure.ts).
2. Add a new row to the alias table at the top of this doc.
3. Re-run `npm run script seed-org-structure`.
4. Add the workspace route in `ypf-ums/app/dashboard/workspaces/<alias>/...`.
5. If the committee needs custom guards (most don't), add them in the relevant `features/api/v1/<resource>/index.ts` route.

## Renaming a committee

Safe to change `name`, `description`. **Never change `alias`** — JWTs in flight, UMS bookmarks, and analytics dashboards all key on it. If a rename is unavoidable, mint a new alias and migrate over a deprecation window.
