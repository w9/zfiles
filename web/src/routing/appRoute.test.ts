import assert from "node:assert/strict";
import test from "node:test";

import { pathnameForRoute, routeFromPathname } from "./appRoute";

test("routeFromPathname maps explorer and settings routes", () => {
  assert.equal(routeFromPathname("/"), "explorer");
  assert.equal(routeFromPathname("/f"), "explorer");
  assert.equal(routeFromPathname("/f/docs/readme"), "explorer");
  assert.equal(routeFromPathname("/settings"), "settings");
  assert.equal(routeFromPathname("/settings/"), "settings");
});

test("pathnameForRoute returns canonical paths", () => {
  assert.equal(pathnameForRoute("explorer"), "/");
  assert.equal(pathnameForRoute("settings"), "/settings");
});

test("app routes respect base subpath", () => {
  const base = "/repo";
  assert.equal(routeFromPathname(`${base}/settings`, base), "settings");
  assert.equal(routeFromPathname(`${base}/f/docs`, base), "explorer");
  assert.equal(pathnameForRoute("settings", base), `${base}/settings`);
  assert.equal(pathnameForRoute("explorer", base), `${base}/`);
});
