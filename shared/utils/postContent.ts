import { ApiError } from "@/shared/types";
import { PostSection, PostStatus } from "@/shared/utils";

/**
 * Pure editorial rules for `content.posts` — no database, no request context.
 * Kept out of `postsService` so the publishing policy can be read (and tested)
 * without standing up a connection.
 */

/** Average adult reading speed, rounded up so nothing ever reads "0 min". */
export function readingMinutes(html?: string | null): number | undefined {
  if (!html) return undefined;
  const words = html
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  if (words === 0) return undefined;
  return Math.max(1, Math.ceil(words / 200));
}

/** Title → URL key. Strips accents, collapses everything else to hyphens. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    // Drop the combining marks that NFKD just split off (é → e + ́ ).
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

/**
 * Cross-field publishing rules that zod can't express per-field:
 *
 *  - nothing publishes without a body;
 *  - a Story of Transformation cannot publish until consent is recorded — these
 *    are real, often vulnerable people, sometimes children, and the flag is the
 *    only thing standing between an editor and publishing someone's story
 *    without permission;
 *  - an annual report cannot publish without the year it covers, because the
 *    year is how the public site groups and labels them.
 *
 * A no-op for drafts, so work in progress is never blocked.
 */
export function assertPublishable(
  post: {
    section?: PostSection;
    body?: string | null;
    consentOnFile?: boolean | null;
    reportYear?: number | null;
  },
  status?: PostStatus,
): void {
  if (status !== "PUBLISHED") return;

  if (!post.body || !post.body.trim()) {
    throw new ApiError("A post needs a body before it can be published.", 400);
  }
  if (post.section === "STORY" && !post.consentOnFile) {
    throw new ApiError(
      "Stories of Transformation cannot be published until written consent is recorded.",
      400,
    );
  }
  if (post.section === "ANNUAL_REPORT" && !post.reportYear) {
    throw new ApiError(
      "An annual report needs the year it covers before it can be published.",
      400,
    );
  }
}
