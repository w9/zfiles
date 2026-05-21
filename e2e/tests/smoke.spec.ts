import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const binary = path.join(rootDir, "target/debug/zfiles");

let server: ChildProcessWithoutNullStreams | null = null;
let serveDir = "";

test.beforeAll(async () => {
  serveDir = fs.mkdtempSync(path.join(os.tmpdir(), "zfiles-e2e-"));
  fs.writeFileSync(path.join(serveDir, "hello.txt"), "hello from e2e\n");

  server = spawn(
    binary,
    ["--port", "9876", "--no-open", serveDir],
    { stdio: "pipe" },
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("server start timeout")), 15_000);
    server!.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server!.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.includes("Error") || text.includes("failed")) {
        clearTimeout(timeout);
        reject(new Error(text));
      }
    });
  });
});

test.afterAll(() => {
  server?.kill("SIGTERM");
});

test("explorer lists served files", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("hello.txt")).toBeVisible();
  await expect(page.getByRole("heading", { name: "zfiles" })).toBeVisible();
});

test("preview pane shows selected file metadata", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /hello\.txt/ }).click();
  const preview = page.getByRole("complementary", { name: "Preview pane" });
  await expect(preview.getByRole("heading", { name: "hello.txt" })).toBeVisible();
  await expect(preview.locator(".preview-meta dt", { hasText: "Size" })).toBeVisible();
  await expect(preview.locator(".preview-meta dd", { hasText: "15 B" })).toBeVisible();
});
