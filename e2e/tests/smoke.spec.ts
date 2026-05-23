import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const binary = path.join(rootDir, "target/debug/zfiles");
const serverReadyMarker = "Press Ctrl+C to stop.";

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
  await page.goto("/");
  await expect(page.getByText("hello.txt")).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Status bar" })).toBeVisible();
});

test("status bar shows connected backend status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status", { name: /backend connected/i })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/kernel v/i);
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
    await expect(page.getByRole("status", { name: /backend offline/i })).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    offlineServer.kill("SIGTERM");
  }
});

test("preview pane shows selected file metadata", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /hello\.txt/ }).click();
  const preview = page.getByRole("complementary", { name: "Preview pane" });
  await expect(preview.getByRole("heading", { name: "hello.txt" })).toBeVisible();
  await expect(preview.getByText("Size", { exact: true })).toBeVisible();
  await expect(preview.getByText("15 B")).toBeVisible();
});

test("context menu shows action plugin entries", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: /hello\.txt/ }).click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Copy path" })).toBeVisible();
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
  await expect(page.getByText("将文件拖放到此处上传")).toBeVisible();
});

test("menu bar and toolbar expose built-in action surfaces", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("toolbar", { name: "Action toolbar" })).toBeVisible();
  await page.getByRole("menubar").getByRole("menuitem", { name: "View" }).click();
  const commandPaletteItem = page.getByRole("menuitem", { name: "Command Palette" });
  await expect(commandPaletteItem).toBeVisible();
  await expect(commandPaletteItem.getByText("Ctrl", { exact: true })).toBeVisible();
  await expect(commandPaletteItem.getByText("P", { exact: true })).toBeVisible();
  await page.keyboard.press("Control+P");
  const palette = page.getByRole("dialog");
  await expect(palette).toBeVisible();
  await expect(palette.getByText("Ctrl", { exact: true }).first()).toBeVisible();
  await expect(palette.getByText("P", { exact: true }).first()).toBeVisible();
});

test("listing shows data table column headers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Type" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Size" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Modified" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Extra" })).toBeVisible();
});

test("plugin manifest action appears in menubar category from manifest", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: /hello\.txt/ }).click();
  await page.getByRole("menubar").getByRole("menuitem", { name: "Selection" }).click();
  await expect(page.getByRole("menuitem", { name: "Copy path" })).toBeVisible();
});

test("disabled toolbar button tooltip explains why action is unavailable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("toolbar", { name: "Action toolbar" }).getByRole("button", {
    name: "Clear Selection",
  }).hover({ force: true });
  await expect(page.getByRole("tooltip")).toContainText("Select one or more files");
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
      if (chunk.toString().includes(serverReadyMarker)) {
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
      if (chunk.toString().includes(serverReadyMarker)) {
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

test("grid view toggle switches listing layout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
  await page.getByRole("button", { name: "Grid view" }).click();
  await expect(page.getByRole("columnheader", { name: "Name" })).not.toBeVisible();
  await page.getByRole("button", { name: "Table view" }).click();
  await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
});

test("slideshow opens for image preview", async ({ page }) => {
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

  const install = spawnSync(
    binary,
    [
      "plugin",
      "install",
      path.join(rootDir, "plugins/image-thumbnailer"),
      "--path",
      imageDir,
    ],
    { encoding: "utf8" },
  );
  if (install.status !== 0) {
    throw new Error(install.stderr || "image-thumbnailer install failed");
  }

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
    await expect(page.getByText("Plugins ready: image-thumbnailer")).toBeVisible();
    await page.getByRole("button", { name: "Grid view" }).click();
    await page.getByRole("button", { name: "slide-a.png", exact: true }).click();
    await expect(
      page.getByRole("complementary", { name: "Preview pane" }).getByRole("heading", {
        name: "slide-a.png",
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+P");
    const palette = page.getByRole("dialog");
    await palette.getByPlaceholder("Type a command…").fill("Slideshow");
    await palette.getByText("Slideshow", { exact: true }).click();
    await expect(page.getByRole("dialog", { name: "slide-a.png" })).toBeVisible();
    await expect(page.getByText("1 / 2")).toBeVisible();
  } finally {
    imageServer.kill("SIGTERM");
  }
});
