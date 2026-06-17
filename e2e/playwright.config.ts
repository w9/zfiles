import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:9876",
    viewport: {
      width: 1280,
      height: 900,
    },
  },
});
