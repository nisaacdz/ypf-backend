import sanitizeHtml from "sanitize-html";

/**
 * Allow-list HTML sanitiser for admin-authored content (announcements,
 * newsletter blocks). Conservative by default — anything we don't explicitly
 * permit is dropped. Adjust the allowed tags / attributes as the editor grows.
 *
 * Defaults are deliberately stricter than `sanitize-html`'s out-of-the-box
 * preset:
 *  - No `script`, `style`, `iframe`, `object`, `embed`, `form`, `input`.
 *  - No `on*` event handlers (the lib strips these by default but listed for
 *    documentation).
 *  - URLs must use http/https/mailto — no `javascript:` or `data:`.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "i",
  "b",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "a",
  "img",
  "hr",
  "code",
  "pre",
  "span",
  "div",
  // Editorial content (content.posts): captioned images, data tables in
  // research write-ups, and footnote markers.
  "h5",
  "h6",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "sup",
  "sub",
];

const ALLOWED_SCHEMES = ["http", "https", "mailto", "tel"];

export function sanitizeRichHtml(input: string): string {
  if (!input) return "";
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      span: ["style"],
      div: ["style"],
      p: ["style"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedStyles: {
      "*": {
        // Plain text color/background — no expressions.
        color: [/^#(?:[0-9a-fA-F]{3}){1,2}$/, /^rgb\(.+\)$/],
        "background-color": [/^#(?:[0-9a-fA-F]{3}){1,2}$/, /^rgb\(.+\)$/],
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
        "font-weight": [/^bold$/, /^normal$/, /^\d{3}$/],
        "font-style": [/^italic$/, /^normal$/],
      },
    },
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    // Force external links to open safely.
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  });
}
