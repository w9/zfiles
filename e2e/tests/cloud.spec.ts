import fs from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const distDir = path.join(rootDir, "web/dist-cloud");
const PORT = 9890;
const origin = `http://127.0.0.1:${PORT}`;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

let server: Server;

/** Serves the built cloud bundle with SPA fallback, standing in for a static host. */
test.beforeAll(async () => {
  if (!fs.existsSync(path.join(distDir, "index.html"))) {
    throw new Error("web/dist-cloud is missing — run `pnpm build:cloud` in web/ first");
  }

  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", origin);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    let filePath = path.join(distDir, relative);
    if (
      !filePath.startsWith(distDir) ||
      !fs.existsSync(filePath) ||
      fs.statSync(filePath).isDirectory()
    ) {
      filePath = path.join(distDir, "index.html");
    }
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise<void>((resolve) => {
    server.listen(PORT, "127.0.0.1", resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

function pill(page: Page, name: RegExp) {
  return page.getByRole("button", { name });
}

/** Creates a folder through the File menu, naming it in the inline editor it opens. */
async function createFolder(page: Page, name: string) {
  await page.getByRole("menubar").getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "New Folder" }).click();
  const nameInput = page.getByRole("textbox", { name: "Rename" });
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await nameInput.press("Enter");
}

test("cloud build opens Browser storage without credentials", async ({ page }) => {
  await page.goto(origin);
  await expect(pill(page, /connection: browser storage/i)).toBeVisible();
  await expect(page.getByRole("contentinfo").first()).toBeVisible();
  await expect(page.getByRole("status", { name: /backend connected/i })).toBeAttached();
});

test("the status-bar pill opens the connection picker", async ({ page }) => {
  await page.goto(origin);
  await pill(page, /connection: browser storage/i).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/choose which storage/i)).toBeVisible();
  await expect(dialog.getByText(/stored in this browser/i)).toBeVisible();
  await expect(dialog.getByRole("button", { name: /create a new connection/i })).toBeVisible();
});

test("the connection form asks for a name and whether to remember keys", async ({ page }) => {
  await page.goto(origin);
  await pill(page, /connection: browser storage/i).click();
  await page.getByRole("dialog").getByRole("button", { name: /create a new connection/i }).click();

  const form = page.getByRole("dialog");
  await expect(form.getByLabel("Name")).toBeVisible();
  await expect(form.getByLabel(/remember keys on this device/i)).not.toBeChecked();
  await expect(form.getByLabel("Bucket")).toBeVisible();
});

test("browser storage keeps a created folder across reloads", async ({ page }) => {
  await page.goto(origin);
  await createFolder(page, "photos");
  await expect(page.getByText("photos").first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("photos").first()).toBeVisible();
});

test("browser storage stores a dropped file", async ({ page }) => {
  await page.goto(origin);
  await expect(page.getByRole("contentinfo").first()).toBeVisible();

  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["stored in the browser\n"], "notes.txt", { type: "text/plain" }),
    );
    return transfer;
  });
  await page.dispatchEvent("body", "dragenter", { dataTransfer });
  await page.dispatchEvent("body", "dragover", { dataTransfer });
  await page.dispatchEvent("body", "drop", { dataTransfer });

  await expect(page.getByText("notes.txt").first()).toBeVisible({ timeout: 15_000 });
});

test("connect=ask opens the picker over Browser storage", async ({ page }) => {
  await page.goto(`${origin}/?connect=ask`);
  await expect(page.getByRole("dialog").getByText(/choose which storage/i)).toBeVisible();
});

test("connect=new without credentials prefills the create form", async ({ page }) => {
  await page.goto(`${origin}/?connect=new&provider=aws&bucket=my-bucket&region=eu-west-1`);

  const form = page.getByRole("dialog");
  await expect(form.getByLabel("Bucket")).toHaveValue("my-bucket");
  await expect(form.getByLabel("Region")).toHaveValue("eu-west-1");
});

test("connect=saved with an unknown name stays on Browser storage", async ({ page }) => {
  await page.goto(`${origin}/?connect=saved:Nope`);

  await expect(page.getByText(/no saved connection named nope/i)).toBeVisible();
  await expect(pill(page, /connection: browser storage/i)).toBeVisible();
});

test("a failed boot connection offers retry without cancel and strips credentials", async ({
  page,
}) => {
  await page.goto(
    `${origin}/?connect=new&provider=r2&bucket=shared&endpoint=http://127.0.0.1:9/#accessKeyId=AKIA&secretAccessKey=sekret`,
  );

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/connection failed/i)).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole("button", { name: /^retry$/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /use a different connection/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^cancel$/i })).toHaveCount(0);

  const url = new URL(page.url());
  expect(url.hash).toBe("");
  expect(url.searchParams.get("bucket")).toBe("shared");

  await dialog.getByRole("button", { name: /use a different connection/i }).click();
  await expect(page.getByRole("dialog").getByText(/choose which storage/i)).toBeVisible();
});
