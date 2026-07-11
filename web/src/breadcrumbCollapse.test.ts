import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  breadcrumbPathScrollLeftMax,
  breadcrumbPathShowsLeftFade,
  pathForBreadcrumbPartIndex,
} from "./breadcrumbCollapse";

describe("pathForBreadcrumbPartIndex", () => {
  it("maps breadcrumb indices to explorer paths", () => {
    const parts = ["alpha", "beta", "gamma"];
    assert.equal(pathForBreadcrumbPartIndex(parts, 0), "alpha");
    assert.equal(pathForBreadcrumbPartIndex(parts, 1), "alpha/beta");
    assert.equal(pathForBreadcrumbPartIndex(parts, 3), "");
  });
});

describe("breadcrumbPathScrollLeftMax", () => {
  it("returns zero when content fits", () => {
    assert.equal(breadcrumbPathScrollLeftMax(100, 200), 0);
  });

  it("returns the overflow amount when content is wider", () => {
    assert.equal(breadcrumbPathScrollLeftMax(400, 250), 150);
  });
});

describe("breadcrumbPathShowsLeftFade", () => {
  it("hides the fade at the start of the scroll range", () => {
    assert.equal(breadcrumbPathShowsLeftFade(0), false);
    assert.equal(breadcrumbPathShowsLeftFade(1), false);
  });

  it("shows the fade once content is scrolled off to the left", () => {
    assert.equal(breadcrumbPathShowsLeftFade(2), true);
    assert.equal(breadcrumbPathShowsLeftFade(120), true);
  });
});
