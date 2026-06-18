import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

marked.setOptions({ gfm: true });

export function renderMarkdownToSafeHtml(markdown: string): string {
  const raw = marked.parse(markdown, { async: false });
  if (typeof raw !== "string") {
    return "";
  }
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
  });
}
