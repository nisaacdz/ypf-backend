import { describe, it, expect } from "vitest";
import {
  assertPublishable,
  readingMinutes,
  slugify,
} from "@/shared/utils/postContent";
import { ApiError } from "@/shared/types";

describe("slugify", () => {
  it("lowercases and hyphenates a title", () => {
    expect(slugify("Her First Term Back")).toBe("her-first-term-back");
  });

  it("strips accents rather than dropping the letter", () => {
    expect(slugify("Café Résumé")).toBe("cafe-resume");
  });

  it("collapses punctuation and runs of separators", () => {
    expect(slugify("YPF Africa: 2025 — Annual Report!!")).toBe(
      "ypf-africa-2025-annual-report",
    );
  });

  it("does not leave leading or trailing hyphens", () => {
    expect(slugify("  ...Stories of Transformation...  ")).toBe(
      "stories-of-transformation",
    );
  });

  it("caps length so the column limit is never the thing that fails", () => {
    expect(slugify("word ".repeat(100)).length).toBeLessThanOrEqual(160);
  });
});

describe("readingMinutes", () => {
  it("is undefined when there is no body", () => {
    expect(readingMinutes(undefined)).toBeUndefined();
    expect(readingMinutes("")).toBeUndefined();
  });

  it("ignores markup when counting words", () => {
    // 10 words wrapped in tags — still well under a minute, so it floors to 1.
    const html = "<p><strong>one</strong> two three four five six seven eight nine ten</p>";
    expect(readingMinutes(html)).toBe(1);
  });

  it("never returns zero for a short post", () => {
    expect(readingMinutes("<p>Short.</p>")).toBe(1);
  });

  it("rounds up at 200 words per minute", () => {
    expect(readingMinutes("word ".repeat(400))).toBe(2);
    expect(readingMinutes("word ".repeat(401))).toBe(3);
  });

  it("treats a markup-only body as having nothing to read", () => {
    expect(readingMinutes("<p></p><div></div>")).toBeUndefined();
  });
});

describe("assertPublishable", () => {
  const publishedStory = {
    section: "STORY" as const,
    body: "<p>A real story.</p>",
    consentOnFile: true,
  };

  it("allows anything while the post is still a draft", () => {
    expect(() =>
      assertPublishable({ section: "STORY", body: null }, "DRAFT"),
    ).not.toThrow();
  });

  it("refuses to publish a post with no body", () => {
    expect(() =>
      assertPublishable({ section: "RESEARCH", body: "   " }, "PUBLISHED"),
    ).toThrow(ApiError);
  });

  it("refuses to publish a story without recorded consent", () => {
    expect(() =>
      assertPublishable({ ...publishedStory, consentOnFile: false }, "PUBLISHED"),
    ).toThrow(/consent/i);
  });

  it("publishes a story once consent is recorded", () => {
    expect(() => assertPublishable(publishedStory, "PUBLISHED")).not.toThrow();
  });

  it("refuses to publish an annual report with no year", () => {
    expect(() =>
      assertPublishable(
        { section: "ANNUAL_REPORT", body: "<p>The year in review.</p>" },
        "PUBLISHED",
      ),
    ).toThrow(/year/i);
  });

  it("does not demand consent from non-story sections", () => {
    expect(() =>
      assertPublishable(
        { section: "RESEARCH", body: "<p>Findings.</p>", consentOnFile: false },
        "PUBLISHED",
      ),
    ).not.toThrow();
  });

  it("raises a 400, not a 500 — these are editor mistakes", () => {
    try {
      assertPublishable({ section: "STORY", body: "<p>x</p>" }, "PUBLISHED");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ApiError).statusCode).toBe(400);
    }
  });
});
