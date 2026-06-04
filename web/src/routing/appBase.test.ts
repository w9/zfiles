import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAppBase,
  stripAppBasePath,
  withAppBasePath,
} from "./appBase";

const REPO = "/repo";

test("normalizeAppBase handles root and subpaths", () => {
  assert.equal(normalizeAppBase("/"), "");
  assert.equal(normalizeAppBase(""), "");
  assert.equal(normalizeAppBase("/repo/"), REPO);
  assert.equal(normalizeAppBase("/repo"), REPO);
});

test("stripAppBasePath removes mount prefix", () => {
  assert.equal(stripAppBasePath("/f/docs", ""), "/f/docs");
  assert.equal(stripAppBasePath("/settings", ""), "/settings");
  assert.equal(stripAppBasePath(`${REPO}/f/docs`, REPO), "/f/docs");
  assert.equal(stripAppBasePath(`${REPO}/`, REPO), "/");
  assert.equal(stripAppBasePath(REPO, REPO), "/");
  assert.equal(stripAppBasePath("/other", REPO), "/other");
});

test("withAppBasePath applies mount prefix", () => {
  assert.equal(withAppBasePath("/", ""), "/");
  assert.equal(withAppBasePath("/settings", ""), "/settings");
  assert.equal(withAppBasePath("/", REPO), `${REPO}/`);
  assert.equal(withAppBasePath("/f/docs", REPO), `${REPO}/f/docs`);
  assert.equal(withAppBasePath("/settings", REPO), `${REPO}/settings`);
});

test("strip and with round-trip internal routes", () => {
  const routes = ["/", "/settings", "/f", "/f/docs/readme"];
  for (const route of routes) {
    const full = withAppBasePath(route, REPO);
    assert.equal(stripAppBasePath(full, REPO), route);
  }
});
