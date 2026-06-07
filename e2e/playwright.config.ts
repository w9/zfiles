import { defineConfig } from "@playwright/test";

/** Inline preview needs main content ≥650/0.4 px; allow for main `p-2` padding. */
const INLINE_PREVIEW_MIN_VIEWPORT_WIDTH = Math.ceil(650 / 0.4) + 32;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:9876",
    viewport: {
      width: INLINE_PREVIEW_MIN_VIEWPORT_WIDTH,
      height: 900,
    },
  },
});
