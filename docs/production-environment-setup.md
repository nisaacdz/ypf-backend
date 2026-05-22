# YPF Africa Production Environment Setup Guide

This document is the production setup runbook for the YPF Africa platform. It covers the backend API, UMS dashboard, public website, database, file storage, email, payments, jobs, domains, and the final verification checklist.

Use this guide before the first production launch, before moving to a new server, and whenever production secrets are rotated.

## 1. Production Architecture

The platform has three deployable applications:

| App | Folder | Runtime | Purpose | Typical production URL |
| --- | --- | --- | --- | --- |
| Backend API | `ypf-backend` | Node.js / Express | API, auth, uploads, payments, jobs, Socket.IO, admin system health | `https://api.ypfafrica.org` |
| UMS dashboard | `ypf-ums` | Next.js | Authenticated dashboard for admins, committees, members, workspaces | `https://ums.ypfafrica.org` |
| Public website | `ypf-africa` | Vite static app | Public pages, membership form, public registration flows | `https://ypfafrica.org` |

Production dependencies:

| Dependency | Used by | Required? | Notes |
| --- | --- | --- | --- |
| PostgreSQL | Backend | Required | Main application database and pg-boss job tables |
| Redis | Backend | Recommended | Response cache and faster system status checks |
| Azure Blob Storage | Backend | Required in production | Stores media and documents in `media` and `docs` containers |
| ImageKit | Backend / frontend media URLs | Required | Generates optimized media URLs and transformations |
| SMTP provider | Backend | Required | Login/member onboarding, notifications, announcements |
| Paystack | Backend | Required for payments | Dues, donations, shop/order payments |
| HTTPS certificates | All apps | Required | Production cookies require HTTPS |

## 2. Domain And Cookie Requirements

The current backend cookie code is configured for the `ypfafrica.org` domain:

- Production auth cookie domain: `.ypfafrica.org`
- Production cookie options: `HttpOnly`, `Secure`, `SameSite=None`, `Partitioned`, `Path=/`
- UMS must run on a subdomain under `ypfafrica.org`, for example `https://ums.ypfafrica.org`
- Backend must also run under HTTPS and be included in CORS, for example `https://api.ypfafrica.org`

Do not deploy production UMS to a different root domain such as `ypf-ums.vercel.app` and expect login cookies to behave perfectly. You can use that temporarily for preview, but the final production domain should be under `.ypfafrica.org`.

Recommended DNS:

| Hostname | Target |
| --- | --- |
| `ypfafrica.org` | Public website host |
| `www.ypfafrica.org` | Redirect to `ypfafrica.org` |
| `ums.ypfafrica.org` | UMS dashboard host |
| `api.ypfafrica.org` | Backend API host |

Backend `ALLOWED_ORIGINS` must include every browser origin that will call the API:

```env
ALLOWED_ORIGINS=https://ypfafrica.org,https://www.ypfafrica.org,https://ums.ypfafrica.org
```

Do not include trailing slashes in `ALLOWED_ORIGINS`.

## 3. Required Accounts To Create First

Create these before deploying:

1. Production PostgreSQL database.
2. Production Redis database or Redis-compatible service.
3. Azure Storage account.
4. ImageKit account connected to the storage/media source.
5. SMTP account, for example AWS SES, SendGrid, Mailgun, Zoho SMTP, or another provider.
6. Paystack live account with live secret key.
7. DNS provider access for `ypfafrica.org`.
8. Hosting accounts for backend, UMS, and public website.
9. A secure secret manager, for example platform secrets, 1Password, Doppler, AWS Secrets Manager, Azure Key Vault, or Vercel/Render/Railway secrets.

Never store production secrets in Git.

## 4. Backend Production Environment

Backend env is validated in `ypf-backend/configs/env.ts`. If a required value is missing or malformed, the server exits during boot.

Create the production backend env from this template:

```env
# Core
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
VERSION=2026.05.19-<git-sha>
YEAR=2026

# Public URLs
DASHBOARD_URL=https://ums.ypfafrica.org
WEBSITE_URL=https://ypfafrica.org
LOGO_URL=https://ypfafrica.org/logo.png

# Browser origins allowed to call the API
ALLOWED_ORIGINS=https://ypfafrica.org,https://www.ypfafrica.org,https://ums.ypfafrica.org

# Security
JWT_SECRET=<64+ character random secret>

# Database
DATABASE_URL=postgres://<user>:<password>@<host>:5432/<database>?sslmode=require

# Cache
REDIS_URL=rediss://:<password>@<host>:6379

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=<account>;AccountKey=<key>;EndpointSuffix=core.windows.net

# ImageKit
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/<your-imagekit-id>
IMAGEKIT_PUBLIC_KEY=public_<value>
IMAGEKIT_PRIVATE_KEY=private_<value>

# Paystack
PAYSTACK_SECRET=sk_live_<value>
PAYSTACK_SUBACCOUNT_CODE=

# SMTP
SMTP_HOST=<smtp-host>
SMTP_USER=<smtp-username>
SMTP_PASS=<smtp-password>
EMAILER=no-reply@ypfafrica.org

# Job queue
JOB_CONCURRENCY=5
JOB_RETENTION_DAYS=7
JOB_RETRY_LIMIT=3
JOB_RETRY_DELAY=60
JOB_ARCHIVE_HOURS=12
```

### Backend variable notes

| Variable | Required | How to set it |
| --- | --- | --- |
| `NODE_ENV` | Yes | Must be `production` in production. This enables secure cookie behavior. |
| `HOST` | Yes | Use `0.0.0.0` in containers and most PaaS hosts. |
| `PORT` | Yes | Use your host's assigned port. If the host injects `PORT`, set this secret to match or configure the start command to pass it. |
| `JWT_SECRET` | Yes | Generate once and protect it. Rotating it logs out all users. |
| `ALLOWED_ORIGINS` | Yes | Comma-separated origins only. No trailing slash. |
| `DATABASE_URL` | Yes | Use SSL in production. |
| `REDIS_URL` | Recommended | Use `rediss://` when your provider supports TLS. The app can start without Redis, but production should use it. |
| `AZURE_STORAGE_CONNECTION_STRING` | Yes | Production uploads require real Azure Blob Storage. |
| `IMAGEKIT_URL_ENDPOINT` | Yes | Must match your ImageKit account endpoint. |
| `IMAGEKIT_PUBLIC_KEY` | Yes | Public key from ImageKit. |
| `IMAGEKIT_PRIVATE_KEY` | Yes | Private key from ImageKit. Keep secret. |
| `PAYSTACK_SECRET` | Yes | Use the live key, not test key, for production. |
| `PAYSTACK_SUBACCOUNT_CODE` | Optional | Use only if Paystack funds should route to a subaccount. |
| `SMTP_HOST` | Yes | SMTP server hostname. |
| `SMTP_USER` | Yes | SMTP username. |
| `SMTP_PASS` | Yes | SMTP password or app password. |
| `EMAILER` | Yes | Verified sender address. |
| `DASHBOARD_URL` | Recommended | Used in emails and links. |
| `WEBSITE_URL` | Recommended | Used in emails and public links. |
| `LOGO_URL` | Yes | Must be a valid URL. |
| `JOB_ARCHIVE_HOURS` | Yes | Must be less than `24`; pg-boss rejects `24` or higher for this setting. |

Generate `JWT_SECRET`:

```sh
openssl rand -base64 48
```

## 5. UMS Production Environment

The UMS dashboard reads the backend URL from `NEXT_PUBLIC_API_URL`.

Create this env for `ypf-ums`:

```env
NEXT_PUBLIC_API_URL=https://api.ypfafrica.org/api/v1
```

Important:

- Include `/api/v1` at the end.
- Do not use `http://` in production.
- Do not point production UMS to localhost.
- Because UMS sends cookie-authenticated requests, the backend must allow `https://ums.ypfafrica.org` in `ALLOWED_ORIGINS`.

UMS production commands:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

If your host installs with npm instead, use one package manager consistently on that host. Do not alternate `npm install` and `pnpm install` in the same deployment directory.

## 6. Public Website Production Environment

The public website reads these Vite variables:

```env
VITE_BACKEND_URL=https://api.ypfafrica.org
VITE_API_URL=https://api.ypfafrica.org
VITE_UMS_URL=https://ums.ypfafrica.org
```

Notes:

- `VITE_BACKEND_URL` or `VITE_API_URL` should be the backend root URL without `/api/v1`.
- The public site API client automatically appends `/api/v1`.
- `VITE_UMS_URL` controls dashboard/login links.
- The public site does not send auth cookies. It uses unauthenticated public endpoints for forms and public data.

Public website production commands:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Deploy the generated static output from:

```text
ypf-africa/dist
```

## 7. Database Setup

Production database requirements:

- PostgreSQL 16 is recommended because local development is using PostgreSQL 16.
- SSL must be enabled for hosted production databases.
- The database user must be able to create schemas and tables during migration.
- Backups must be enabled before launch.

Recommended database name:

```text
ypf_prod
```

Recommended schemas used by the app:

| Schema | Purpose |
| --- | --- |
| `core` | Members, constituents, committees, chapters, users, documents |
| `finance` | Payments, donations, dues, orders, budgets |
| `logs` | Workspace submissions, notes, attachments, reports/audit-style records |
| `app` | System settings, audit logs, maintenance settings |
| `pgboss` | pg-boss job queue tables, auto-created by pg-boss |

First production database flow:

```sh
cd ypf-backend
pnpm install --frozen-lockfile
npx drizzle-kit migrate
pnpm run script patch-db
pnpm run script seed-org-structure
```

What each command does:

| Command | Purpose |
| --- | --- |
| `npx drizzle-kit migrate` | Applies Drizzle migrations from `db/migrations`. |
| `pnpm run script patch-db` | Applies manual constraints/triggers that are not fully represented by Drizzle. |
| `pnpm run script seed-org-structure` | Creates the canonical committees, member titles, and organizational structure. This is required for workspaces and role assignment. |

Do not run these in production:

```sh
pnpm run script reset-db
pnpm run script seed-test-users
pnpm run script seed-demo-data
pnpm run script seed-dummy
```

Those are for development/testing data only.

## 8. Creating The First Production Super Admin

The current development seed creates `admin@ypfafrica.org / Admin123!`, but that seed must not be used in production.

Recommended production flow:

1. Run migrations.
2. Run `seed-org-structure`.
3. Create one real constituent/user for the founder or system owner using a controlled one-time script or direct SQL.
4. Assign that constituent super admin access.
5. Log in immediately and change/verify credentials.
6. Use the UMS admin interface to invite or approve all other users.

Minimum rule:

- There should be at least one production super admin before public launch.
- There should be at least two production super admins after launch for continuity.
- Do not keep shared admin accounts.
- Do not use test passwords in production.

## 9. Azure Blob Storage Setup

The backend expects two Azure containers:

| Container | Purpose |
| --- | --- |
| `media` | Images, videos, public media assets |
| `docs` | Documents, submissions, workspace attachments, private files |

Setup steps:

1. Create an Azure Storage account.
2. Create private blob containers named exactly `media` and `docs`.
3. Copy the storage account connection string.
4. Set `AZURE_STORAGE_CONNECTION_STRING`.
5. Confirm the backend can upload, preview, download, and delete files.

Production warning:

- Local document storage is only used in non-production when the storage connection string contains `stub`.
- In production, Azure Blob Storage must be real and reachable.
- The backend upload limit for documents is currently `10 MB`.

## 10. ImageKit Setup

ImageKit is used to generate optimized media URLs and transformations.

Setup steps:

1. Create an ImageKit account.
2. Add the production media source.
3. Configure the URL endpoint.
4. Copy public and private keys.
5. Set:

```env
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/<your-imagekit-id>
IMAGEKIT_PUBLIC_KEY=public_<value>
IMAGEKIT_PRIVATE_KEY=private_<value>
```

Verification:

- Upload an image from UMS.
- Confirm it appears in the app.
- Confirm the generated URL uses the ImageKit endpoint.
- Confirm video thumbnail generation does not break pages using media.

## 11. SMTP Email Setup

SMTP is required for transactional email and queued notifications.

Use a sender address that is verified by your SMTP provider:

```env
EMAILER=no-reply@ypfafrica.org
SMTP_HOST=<smtp-host>
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
```

DNS records to configure for reliable delivery:

| Record | Purpose |
| --- | --- |
| SPF | Authorizes the mail provider to send for the domain |
| DKIM | Signs emails and improves deliverability |
| DMARC | Protects the domain and improves trust |

Verification:

1. Start backend.
2. Use the UMS flow that sends an onboarding or notification email.
3. Confirm email arrives in inbox, not spam.
4. Check backend logs for SMTP errors.
5. Check `/api/v1/system/health` in UMS System page as a super admin or technical committee user.

## 12. Paystack Setup

Paystack is used for dues, donations, and shop/order payment verification.

Set:

```env
PAYSTACK_SECRET=sk_live_<value>
PAYSTACK_SUBACCOUNT_CODE=
```

Production checklist:

1. Use live secret key, not test key.
2. Confirm Paystack business verification is complete.
3. Configure callback/redirect URLs in Paystack if used by the live flow.
4. Make one low-value live test transaction.
5. Confirm the transaction appears in UMS finance views.
6. Confirm verification updates the transaction status.
7. Confirm failed/cancelled payments do not mark dues or orders as paid.

If funds should route to a Paystack subaccount, set `PAYSTACK_SUBACCOUNT_CODE=ACCT_xxxxxxxxxx`. Leave it blank to keep funds on the main Paystack account.

## 13. Redis And Jobs

Redis is recommended for production caching and system health performance.

Set:

```env
REDIS_URL=rediss://:<password>@<host>:6379
```

The backend also uses pg-boss for background jobs. Pg-boss uses the PostgreSQL database and auto-creates its own tables in the `pgboss` schema when the backend starts.

Job settings:

```env
JOB_CONCURRENCY=5
JOB_RETENTION_DAYS=7
JOB_RETRY_LIMIT=3
JOB_RETRY_DELAY=60
JOB_ARCHIVE_HOURS=12
```

Important:

- `JOB_ARCHIVE_HOURS` must stay below `24`.
- If background jobs are failing, use the UMS System page to inspect failed jobs.
- In production, run only one backend instance with active workers unless you have confirmed the queue behavior under multiple instances.

## 14. Backend Build And Start

Production build:

```sh
cd ypf-backend
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Equivalent npm flow if your host is npm-based:

```sh
npm ci
npm run build
npm start
```

Start command:

```sh
node dist/app.js
```

Health check:

```sh
curl https://api.ypfafrica.org/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "..."
  }
}
```

Swagger docs:

```text
https://api.ypfafrica.org/docs
```

You may choose to restrict `/docs` at the reverse proxy layer in production if you do not want public API documentation exposed.

## 15. Reverse Proxy And HTTPS

If using Nginx or another reverse proxy, it must:

- Terminate HTTPS.
- Forward requests to backend `PORT`.
- Preserve cookies.
- Preserve `Origin`.
- Preserve `Host`.
- Support WebSocket upgrades for Socket.IO.
- Allow file uploads up to at least `10 MB`.

Nginx-style requirements:

```nginx
client_max_body_size 20m;

proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Production must use HTTPS because secure cookies will not be stored over HTTP.

## 16. Deployment Order

Use this exact order for first launch:

1. Prepare DNS records.
2. Create production PostgreSQL database.
3. Create production Redis.
4. Create Azure Storage containers.
5. Configure ImageKit.
6. Configure SMTP and DNS email records.
7. Configure Paystack live account.
8. Add backend production env secrets.
9. Deploy backend.
10. Run database migrations.
11. Run `seed-org-structure`.
12. Create first production super admin.
13. Verify backend `/health`.
14. Verify backend `/docs`, if docs are public.
15. Add UMS production env.
16. Deploy UMS.
17. Add public website production env.
18. Deploy public website.
19. Test login from UMS.
20. Test public membership form.
21. Test file upload from a workspace.
22. Test payment flow with a small live transaction.
23. Test email delivery.
24. Turn on monitoring and backups.

## 17. Final Production Smoke Test

Run these checks before announcing launch.

Backend:

```sh
curl -i https://api.ypfafrica.org/health
curl -i https://api.ypfafrica.org/api/v1/chapters?pageSize=1
curl -i https://api.ypfafrica.org/api/v1/committees?pageSize=1
```

UMS:

1. Visit `https://ums.ypfafrica.org`.
2. Log in as a real super admin.
3. Confirm the browser stores `access_token` as a secure HttpOnly cookie.
4. Open Dashboard.
5. Open Directory.
6. Open Committees.
7. Open Workspaces.
8. Open System page.
9. Confirm no `403` on pages the user should access.
10. Confirm member-restricted actions are hidden or blocked for normal members.

Public website:

1. Visit `https://ypfafrica.org`.
2. Open membership registration.
3. Confirm chapters load from backend.
4. Confirm committees load from backend.
5. Submit a test application.
6. Confirm HR can see the application in UMS.

Uploads:

1. Log in as a committee chair or super admin.
2. Upload a document attachment in a workspace.
3. Preview it.
4. Download it.
5. Delete it if it was only a test.

Payments:

1. Make a small live Paystack transaction.
2. Confirm Paystack shows success.
3. Confirm UMS shows the transaction.
4. Confirm the member/dues/order status updates correctly.

Email:

1. Trigger an onboarding or notification email.
2. Confirm delivery.
3. Confirm sender is correct.
4. Check spam folder.
5. Check backend logs.

Reports:

1. Open a committee workspace.
2. Create a workspace record.
3. Open Reports tab.
4. Confirm the generated report reflects the record.
5. Submit monthly plan/report as chair.
6. Confirm super admin can view committee reports.

## 18. Production Monitoring

Minimum monitoring:

| Area | What to monitor |
| --- | --- |
| Backend uptime | `/health` every 1 minute |
| API errors | 5xx rate, failed auth spikes, CORS errors |
| Database | CPU, storage, connections, slow queries |
| Redis | connectivity, memory usage |
| Jobs | failed jobs, queue backlog |
| SMTP | send failures, bounce rate |
| Paystack | verification failures |
| Azure Blob | upload/download failures |
| Disk | only critical if running on VM/container with local logs |
| SSL | certificate expiry |

UMS already includes system health surfaces for admins/technical users. Use that as the human-facing operational dashboard, but still configure external uptime monitoring.

## 19. Backup And Recovery

Before launch:

- Enable automated PostgreSQL backups.
- Confirm point-in-time restore if your provider supports it.
- Record Azure Blob recovery/retention policy.
- Export and securely store production env secrets.
- Document who has access to DNS, hosting, database, Azure, Paystack, SMTP, and ImageKit.

Suggested backup policy:

| Data | Backup frequency | Retention |
| --- | --- | --- |
| PostgreSQL | Daily automated backup plus PITR if available | 30 days minimum |
| Azure Blob docs/media | Soft delete/versioning if available | 30 days minimum |
| Env secrets | On every rotation | Keep current and previous only |
| Deployment artifacts | Every release | Keep at least last 5 releases |

Monthly recovery drill:

1. Restore latest backup to a staging database.
2. Start backend against staging env.
3. Confirm login, directory, workspaces, reports, uploads.
4. Record restore time and issues.

## 20. Security Checklist

Before launch:

- `NODE_ENV=production`.
- All URLs use HTTPS.
- `JWT_SECRET` is strong and private.
- `ALLOWED_ORIGINS` contains only trusted production origins.
- No test user seed has been run in production.
- Test accounts and demo passwords do not exist in production.
- Paystack uses `sk_live_`, not `sk_test_`.
- SMTP sender is verified.
- Database is not publicly open without protection.
- Redis is not publicly open without auth/TLS.
- Azure containers are private unless intentionally public.
- ImageKit private key is not exposed to frontend.
- UMS only exposes `NEXT_PUBLIC_API_URL`.
- Public website only exposes `VITE_*` public values.
- Super admin access is limited to trusted people.
- Committee role assignment remains restricted to super admin.
- File upload limit is understood and acceptable.
- Backups are enabled.

## 21. Common Problems And Fixes

### Login works but dashboard API calls return `401`

Likely causes:

- UMS is not using `https://ums.ypfafrica.org`.
- Backend is not using HTTPS.
- Cookie domain `.ypfafrica.org` does not match the deployed UMS domain.
- `NEXT_PUBLIC_API_URL` points to the wrong API.
- Browser blocked cookies because `SameSite=None` cookies require `Secure`.

Fix:

1. Confirm UMS URL is under `.ypfafrica.org`.
2. Confirm backend URL is HTTPS.
3. Confirm `NEXT_PUBLIC_API_URL=https://api.ypfafrica.org/api/v1`.
4. Confirm backend `NODE_ENV=production`.

### Browser shows CORS errors

Likely causes:

- Missing frontend origin in `ALLOWED_ORIGINS`.
- Origin has a trailing slash in env.
- Public website is using `www.ypfafrica.org` but only `ypfafrica.org` is allowed.

Fix:

```env
ALLOWED_ORIGINS=https://ypfafrica.org,https://www.ypfafrica.org,https://ums.ypfafrica.org
```

Restart backend after changing it.

### Uploads fail

Likely causes:

- Bad `AZURE_STORAGE_CONNECTION_STRING`.
- Missing `media` or `docs` container.
- File is larger than `10 MB`.
- Reverse proxy body size is too small.
- ImageKit keys are wrong.

Fix:

1. Confirm Azure containers exist.
2. Confirm backend can write to Azure.
3. Increase reverse proxy upload limit to at least `20 MB`.
4. Confirm ImageKit endpoint and keys.

### Payments do not mark as successful

Likely causes:

- Using Paystack test key in production.
- Verification call is failing.
- Callback/reference mismatch.
- User closed payment flow before verification completed.

Fix:

1. Confirm `PAYSTACK_SECRET` starts with `sk_live_`.
2. Check backend logs.
3. Confirm transaction exists in Paystack dashboard.
4. Re-run/trigger verification flow from UMS if available.

### Emails do not send

Likely causes:

- SMTP credentials wrong.
- Sender address not verified.
- Provider blocks login from production server.
- SPF/DKIM/DMARC missing.

Fix:

1. Verify sender in SMTP provider.
2. Confirm `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAILER`.
3. Check backend logs.
4. Check provider suppression/bounce list.

### `pnpm dev` or install fails with ignored builds

If pnpm says build scripts were ignored, approve only trusted packages required by this project:

```sh
pnpm approve-builds
```

Then reinstall:

```sh
pnpm install
```

For production, prefer clean CI installs with a committed lockfile and consistent package manager.

## 22. Release Checklist

Use this before every production release:

1. Pull latest code.
2. Confirm env changes are documented.
3. Run backend build:

   ```sh
   cd ypf-backend
   pnpm build
   ```

4. Run UMS build:

   ```sh
   cd ypf-ums
   pnpm build
   ```

5. Run public website build:

   ```sh
   cd ypf-africa
   pnpm build
   ```

6. Run migrations if there are new files in `ypf-backend/db/migrations`.
7. Deploy backend first.
8. Deploy UMS.
9. Deploy public website.
10. Smoke test login, public forms, uploads, payments, and reports.
11. Watch logs for at least 15 minutes.
12. Keep previous release available for rollback.

## 23. Production Env Ownership

Recommended ownership:

| Area | Owner |
| --- | --- |
| Backend/API env | Technical Committee + Super Admin |
| UMS env | Technical Committee |
| Public website env | Technical Committee + Media/Communications where relevant |
| Paystack | Finance Committee + Super Admin |
| SMTP | Technical Committee + Admin |
| Azure/ImageKit | Technical Committee |
| Database backups | Technical Committee |
| Committee role assignments | Super Admin only |

## 24. Final Launch Sign-Off

Do not launch publicly until each item is checked:

- [ ] Production backend is live on HTTPS.
- [ ] Production UMS is live on HTTPS.
- [ ] Production public website is live on HTTPS.
- [ ] DNS records are correct.
- [ ] `ALLOWED_ORIGINS` is correct.
- [ ] Login works on UMS.
- [ ] Public membership registration reaches backend.
- [ ] HR can see submitted applications.
- [ ] Committee workspaces load.
- [ ] Super admin can assign committee roles.
- [ ] Members have restricted workspace actions.
- [ ] Uploads work.
- [ ] Emails send.
- [ ] Paystack live test works.
- [ ] Generated reports work.
- [ ] Backups are enabled.
- [ ] Monitoring is enabled.
- [ ] At least two trusted super admins exist.

