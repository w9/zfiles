import assert from "node:assert/strict";
import test from "node:test";

import { renderMarkdownToSafeHtml } from "./renderMarkdown";

test("renderMarkdownToSafeHtml renders headings", () => {
  const html = renderMarkdownToSafeHtml("# Hello");
  assert.match(html, /<h1[^>]*>Hello<\/h1>/);
});

test("renderMarkdownToSafeHtml strips script tags", () => {
  const html = renderMarkdownToSafeHtml(
    '# Title\n<script>alert("xss")</script>\n\nSafe **bold**',
  );
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /<strong>bold<\/strong>/);
});

test("renderMarkdownToSafeHtml strips inline event handlers", () => {
  const html = renderMarkdownToSafeHtml(
    '<img src="x" onerror="alert(1)" alt="x">',
  );
  assert.doesNotMatch(html, /onerror/i);
});
