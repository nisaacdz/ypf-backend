/**
 * Test-suite environment seeding.
 *
 * This file MUST be the very first entry in `vitest.config.ts → setupFiles`
 * so it runs before anything in `tests/setup.ts` (which transitively imports
 * `@/configs/env`, the schema-validated env module that calls
 * `process.exit(1)` on any missing key).
 *
 * Strategy: every key the env schema requires gets a safe dummy fallback
 * via `setIfUnset()`. That means:
 *   - CI environments that DO inject real secrets keep using them (because
 *     setIfUnset is a no-op when the key is already set).
 *   - Contributors running `npm test` locally with no .env succeed too.
 *   - Pull-request CI from forks (no access to secrets) still passes the
 *     env validation gate — the actual integration tests stub their own
 *     external boundaries (DB, SMTP, Paystack, ImageKit) so dummy values
 *     never reach real services.
 *
 * Do NOT import production code here — that would re-introduce the bug
 * this file is fixing.
 */

function setIfUnset(key: string, value: string): void {
  if (!process.env[key] || process.env[key]?.trim() === "") {
    process.env[key] = value;
  }
}

// Hard-required by configs/env.ts schema.
setIfUnset("NODE_ENV", "test");
setIfUnset(
  "JWT_SECRET",
  // 64-char dummy — must be ≥32 chars to satisfy the Zod min length.
  "test-jwt-secret-test-jwt-secret-test-jwt-secret-test-jwt-secret-",
);
setIfUnset("DATABASE_URL", "postgres://test:test@localhost:5432/ypf_test");
setIfUnset(
  "AZURE_STORAGE_CONNECTION_STRING",
  "DefaultEndpointsProtocol=https;AccountName=test;AccountKey=test;EndpointSuffix=core.windows.net",
);
setIfUnset("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/test");
setIfUnset("IMAGEKIT_PUBLIC_KEY", "public_test_key");
setIfUnset("IMAGEKIT_PRIVATE_KEY", "private_test_key");
setIfUnset("PAYSTACK_SECRET", "sk_test_dummy_paystack_key_for_ci");
setIfUnset("SMTP_HOST", "smtp.test.local");
setIfUnset("SMTP_USER", "test@ypfafrica.test");
setIfUnset("SMTP_PASS", "test-password");
setIfUnset("EMAILER", "noreply@ypfafrica.test");
setIfUnset("LOGO_URL", "https://ypfafrica.test/logo.png");
setIfUnset("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173");
