import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const binary = path.join(rootDir, "target/debug/zfiles");
const serverReadyMarker = "Press Ctrl+C to stop.";

function listingEntry(page: Page, name: string | RegExp) {
  return page.locator("[data-listing-entry]").filter({ hasText: name });
}

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
      if (chunk.toString().includes(serverReadyMarker)) {
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
  const forbidden: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (
      url.includes("/api/plugins")
      || url.includes("/api/search")
      || url.includes("/api/thumbnail")
    ) {
      forbidden.push(url);
    }
  });

  await page.goto("/");
  await expect(page.getByText("hello.txt")).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Status bar" })).toBeVisible();
  expect(forbidden).toEqual([]);
});

test("status bar shows connected backend status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status", { name: /backend connected/i })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/connected to/i);
});

test("status bar opens keyboard shortcuts from Help menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("menuitem", { name: "Help" }).click();
  await page.getByRole("menuitem", { name: "Keyboard shortcuts…" }).click();
  const shortcutsDialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(shortcutsDialog).toBeVisible();
  await expect(shortcutsDialog.getByText("Command Palette")).toBeVisible();
});

test("theme toggle switches color theme", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("zfiles-theme", "light"));
  await page.reload();
  await page.getByRole("button", { name: "Color theme: Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await page.getByRole("button", { name: "Color theme: Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "auto");
});

test("theme preference persists across reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("zfiles-theme", "light"));
  await page.reload();
  await page.getByRole("button", { name: "Color theme: Light" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await expect(page.getByRole("button", { name: "Color theme: Dark" })).toBeVisible();
});

test("header shows offline backend status after server stops", async ({ page }) => {
  const offlineDir = fs.mkdtempSync(path.join(os.tmpdir(), "zfiles-e2e-offline-"));
  fs.writeFileSync(path.join(offlineDir, "offline.txt"), "offline fixture\n");

  const offlineServer = spawn(
    binary,
    ["--port", "9879", "--no-open", offlineDir],
    { stdio: "pipe" },
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("offline server start timeout")), 15_000);
    offlineServer.stdout.on("data", (chunk) => {
      if (chunk.toString().includes(serverReadyMarker)) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  try {
    await page.goto("http://127.0.0.1:9879/");
    await expect(page.getByRole("status", { name: /backend connected/i })).toBeVisible();
    offlineServer.kill("SIGTERM");
    await expect(page.getByRole("status", { name: /backend connection lost/i })).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    offlineServer.kill("SIGTERM");
  }
});

test("Get Info dialog shows selected file metadata", async ({ page }) => {
  await page.goto("/");
  await listingEntry(page, /hello\.txt/).click();
  await page.keyboard.press("ControlOrMeta+I");
  const infoPanel = page.getByRole("dialog", { name: "Get Info" });
  await expect(infoPanel.getByRole("heading", { name: "Info of hello.txt" })).toBeVisible();
  await expect(infoPanel.getByText("Size", { exact: true })).toBeVisible();
  await expect(infoPanel.getByText("15 B")).toBeVisible();
});

test("context menu shows built-in file actions", async ({ page }) => {
  await page.goto("/");
  await listingEntry(page, /hello\.txt/).click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Copy Path" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Download" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
});

test("command palette opens and lists built-in actions", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+P");
  const palette = page.getByRole("dialog");
  await expect(palette).toBeVisible();
  await expect(palette.getByText("Move Selection Down")).toBeVisible();
  await palette.getByText("Move Selection Down").click();
  await expect(palette).not.toBeVisible();
});

test("lang query param switches UI to Simplified Chinese", async ({ page }) => {
  await page.goto("/?lang=zh-CN");
  await expect(page.getByRole("contentinfo", { name: "状态栏" })).toBeVisible();
  await expect(page.getByRole("button", { name: "上传" })).toBeVisible();
});

test("menu bar and toolbar expose built-in action surfaces", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("toolbar", { name: "Action toolbar" })).toBeVisible();
  await page.getByRole("menubar").getByRole("menuitem", { name: "Help" }).click();
  const commandPaletteItem = page.getByRole("menuitem", { name: "Command Palette" });
  await expect(commandPaletteItem).toBeVisible();
  await expect(commandPaletteItem).toContainText("Ctrl+P");
  await page.keyboard.press("Control+P");
  const palette = page.getByRole("dialog");
  await expect(palette).toBeVisible();
  await expect(palette.getByText("Ctrl+P").first()).toBeVisible();
});

test("listing shows data table column headers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Size" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Modified" })).toBeVisible();
});

test("tokenized explorer loads listing", async ({ page }) => {
  const tokenDir = fs.mkdtempSync(path.join(os.tmpdir(), "zfiles-e2e-token-"));
  fs.writeFileSync(path.join(tokenDir, "secret.txt"), "token fixture\n");

  let authToken = "";
  const tokenServer = spawn(
    binary,
    ["--port", "9880", "--token", "--no-open", tokenDir],
    { stdio: "pipe" },
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("token server start timeout")), 15_000);
    tokenServer.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      const match = text.match(/[?&]token=([0-9a-f]{32})/);
      if (match) {
        authToken = match[1];
      }
      if (text.includes("Press Ctrl+C to stop.") || text.includes("zfiles is running")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  if (!authToken) {
    tokenServer.kill("SIGTERM");
    throw new Error("token server did not print auth token");
  }

  try {
    await page.goto(`http://127.0.0.1:9880/?token=${authToken}`);
    await expect(page.getByText("secret.txt")).toBeVisible();
    await expect(page.getByRole("status", { name: /backend connected/i })).toBeVisible();
  } finally {
    tokenServer.kill("SIGTERM");
  }
});

test("grid view toggle switches listing layout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
  await page.getByRole("button", { name: "Grid view" }).click();
  await expect(page.getByRole("columnheader", { name: "Name" })).not.toBeVisible();
  await page.getByRole("button", { name: "Table view" }).click();
  await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
});

test("preview overlay opens for images", async ({ page }) => {
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "zfiles-e2e-slideshow-"));
  fs.writeFileSync(
    path.join(imageDir, "slide-a.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  fs.writeFileSync(
    path.join(imageDir, "slide-b.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    ),
  );

  const imageServer = spawn(
    binary,
    ["--port", "9881", "--no-open", imageDir],
    { stdio: "pipe" },
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("slideshow server start timeout")), 15_000);
    imageServer.stdout.on("data", (chunk) => {
      if (chunk.toString().includes(serverReadyMarker)) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  try {
    await page.goto("http://127.0.0.1:9881/");
    await page.getByRole("button", { name: "Grid view" }).click();
    await page.getByRole("button", { name: "slide-a.png", exact: true }).click();
    await page
      .getByRole("button", { name: "slide-b.png", exact: true })
      .click({ modifiers: ["ControlOrMeta"] });
    await page.keyboard.press("Control+P");
    const palette = page.getByRole("dialog");
    await palette.getByPlaceholder("Type a command…").fill("Preview");
    await palette.getByRole("option", { name: "Preview" }).click();
    const preview = page.getByRole("dialog", { name: /slide-[ab]\.png/ });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole("button", { name: "Previous" })).toBeVisible();
    await expect(preview.getByRole("button", { name: "Next" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(preview).not.toBeVisible();
  } finally {
    imageServer.kill("SIGTERM");
  }
});

test("Get Info dialog shows image file metadata without inline preview", async ({ page }) => {
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "zfiles-e2e-preview-image-"));
  fs.writeFileSync(
    path.join(imageDir, "photo.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );

  const imageServer = spawn(
    binary,
    ["--port", "9882", "--no-open", imageDir],
    { stdio: "pipe" },
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("preview image server start timeout")), 15_000);
    imageServer.stdout.on("data", (chunk) => {
      if (chunk.toString().includes(serverReadyMarker)) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  try {
    await page.goto("http://127.0.0.1:9882/");
    await listingEntry(page, "photo.png").click();
    await page.keyboard.press("ControlOrMeta+I");
    const infoPanel = page.getByRole("dialog", { name: "Get Info" });
    await expect(infoPanel.getByRole("heading", { name: "Info of photo.png" })).toBeVisible();
    await expect(infoPanel.getByText("Size", { exact: true })).toBeVisible();
    await expect(infoPanel.getByRole("img")).not.toBeVisible();
  } finally {
    imageServer.kill("SIGTERM");
  }
});
