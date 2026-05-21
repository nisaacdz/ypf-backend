import * as Sentry from "@sentry/node";
import variables from "@/configs/env";
import logger from "@/configs/logger";

/**
 * Initialise Sentry as early as possible in the process lifecycle. A no-op
 * when SENTRY_DSN isn't set — that's the dev/test default. In production,
 * leave the DSN configured; otherwise crashes vanish silently.
 *
 * The Sentry SDK monkey-patches Node internals on init, which is why we call
 * this before any other imports that might wrap http/express.
 */
export function initSentry(): void {
  const dsn = variables.services.sentry.dsn;
  if (!dsn) {
    logger.info("Sentry DSN not configured — error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: variables.app.environment,
    release: variables.app.version,
    tracesSampleRate: variables.services.sentry.tracesSampleRate,
    // Strip cookies / auth from server transactions — those bypass DSR.
    sendDefaultPii: false,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
    beforeSend(event) {
      // Mask the JWT cookie if it leaks into a captured request.
      if (event.request?.cookies?.access_token) {
        event.request.cookies.access_token = "[redacted]";
      }
      return event;
    },
  });

  logger.info("Sentry initialised");
}

export { Sentry };
