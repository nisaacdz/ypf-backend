/**
 * Shared test helpers for integration tests.
 *
 * The biggest landmine here is the login response: `/api/v1/auth/login`
 * proactively clears every prior `access_token` cookie variant (different
 * cookie attributes survive a deploy change) BEFORE setting the new token.
 * That means `set-cookie` is an array of ~5 entries, most of which start
 * with `access_token=;` — i.e. clear-cookies with an empty value.
 *
 * A naive `cookies.find(c => c.includes("access_token"))` matches the FIRST
 * (empty) one. `extractAccessTokenCookie` digs out the real one: an
 * access_token cookie whose value is non-empty.
 */

/**
 * Pull the FULL Set-Cookie line (`access_token=<value>; HttpOnly; ...`) for
 * the real access token, ignoring the clear-cookies. Useful for tests that
 * want to assert cookie attributes like HttpOnly / Path.
 */
export function findAccessTokenSetCookie(
  setCookieHeader: string | string[] | undefined,
): string | undefined {
  if (!setCookieHeader) return undefined;
  const list = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  return list.find((c) => /^access_token=[^;\s]/.test(c));
}

/**
 * Pull just the `access_token=<value>` half — supertest accepts this form as
 * a Cookie header on subsequent requests.
 */
export function extractAccessTokenCookie(
  setCookieHeader: string | string[] | undefined,
): string {
  const real = findAccessTokenSetCookie(setCookieHeader);
  return real ? real.split(";")[0] : "";
}
