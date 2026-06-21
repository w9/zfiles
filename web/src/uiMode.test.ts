import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_UI_MODE,
  nextUiMode,
  parseUiMode,
  resolvedUiMode,
} from "./uiMode.ts";

describe("resolvedUiMode", () => {
  it("returns explicit mouse and touch modes", () => {
    assert.equal(resolvedUiMode("mouse", true), "mouse");
    assert.equal(resolvedUiMode("touch", false), "touch");
  });

  it("follows coarse pointer in auto mode", () => {
    assert.equal(resolvedUiMode("auto", true), "touch");
    assert.equal(resolvedUiMode("auto", false), "mouse");
  });
});

describe("parseUiMode", () => {
  it("defaults invalid values to auto", () => {
    assert.equal(parseUiMode(null), DEFAULT_UI_MODE);
    assert.equal(parseUiMode("invalid"), DEFAULT_UI_MODE);
  });

  it("accepts known ui modes", () => {
    assert.equal(parseUiMode("mouse"), "mouse");
    assert.equal(parseUiMode("touch"), "touch");
    assert.equal(parseUiMode("auto"), "auto");
  });
});

describe("nextUiMode", () => {
  it("cycles mouse, touch, and auto", () => {
    assert.equal(nextUiMode("mouse"), "touch");
    assert.equal(nextUiMode("touch"), "auto");
    assert.equal(nextUiMode("auto"), "mouse");
  });
});
