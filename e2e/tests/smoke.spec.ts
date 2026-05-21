import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
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

  const install = spawnSync(
    binary,
    [
      "plugin",
      "install",
      path.join(rootDir, "fixtures/plugins/action-copy"),
      "--path",
      serveDir,
    ],
    { encoding: "utf8" },
  );
  if (install.status !== 0) {
    throw new Error(install.stderr || "plugin install failed");
  }

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

test("context menu shows action plugin entries", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: /hello\.txt/ }).click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Copy path" })).toBeVisible();
});

test("viewer ESM module renders preview body", async ({ page }) => {
  const viewerDir = fs.mkdtempSync(path.join(os.tmpdir(), "zfiles-e2e-viewer-"));
  fs.writeFileSync(path.join(viewerDir, "notes.txt"), "hello from viewer esm\n");

  const install = spawnSync(
    binary,
    [
      "plugin",
      "install",
      path.join(rootDir, "fixtures/plugins/viewer-text"),
      "--path",
      viewerDir,
    ],
    { encoding: "utf8" },
  );
  if (install.status !== 0) {
    throw new Error(install.stderr || "viewer plugin install failed");
  }

  const viewerServer = spawn(
    binary,
    ["--port", "9877", "--no-open", viewerDir],
    { stdio: "pipe" },
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("viewer server start timeout")), 15_000);
    viewerServer.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  try {
    await page.goto("http://127.0.0.1:9877/");
    await page.waitForTimeout(500);
    await page.getByRole("link", { name: /notes\.txt/ }).click();
    await expect(page.getByText("ESM viewer for notes.txt")).toBeVisible();
    await expect(page.getByText("hello from viewer esm")).toBeVisible();
  } finally {
    viewerServer.kill("SIGTERM");
  }
});

test("untrusted viewer renders inside sandbox iframe", async ({ page }) => {
  const viewerDir = fs.mkdtempSync(path.join(os.tmpdir(), "zfiles-e2e-untrusted-"));
  fs.writeFileSync(path.join(viewerDir, "notes.txt"), "hello from sandbox\n");

  const install = spawnSync(
    binary,
    [
      "plugin",
      "install",
      path.join(rootDir, "fixtures/plugins/viewer-untrusted"),
      "--path",
      viewerDir,
    ],
    { encoding: "utf8" },
  );
  if (install.status !== 0) {
    throw new Error(install.stderr || "untrusted viewer install failed");
  }

  const viewerServer = spawn(
    binary,
    ["--port", "9878", "--no-open", viewerDir],
    { stdio: "pipe" },
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("untrusted server start timeout")), 15_000);
    viewerServer.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  try {
    await page.goto("http://127.0.0.1:9878/");
    await page.waitForTimeout(500);
    await page.getByRole("link", { name: /notes\.txt/ }).click();
    const iframe = page.frameLocator('iframe[title="Sandboxed preview"]');
    await expect(iframe.getByText("Sandboxed viewer for notes.txt")).toBeVisible();
    await expect(iframe.getByText("hello from sandbox")).toBeVisible();
  } finally {
    viewerServer.kill("SIGTERM");
  }
});
