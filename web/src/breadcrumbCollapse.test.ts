import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collapsedBreadcrumbMiddle,
  middleSegmentIndices,
  pathForBreadcrumbPartIndex,
} from "./breadcrumbCollapse";

describe("middleSegmentIndices", () => {
  it("returns no middle indices for root-only paths", () => {
    assert.deepEqual(middleSegmentIndices(1), []);
  });

  it("returns no middle indices for root plus one segment", () => {
    assert.deepEqual(middleSegmentIndices(2), []);
  });

  it("returns interior indices for deeper paths", () => {
    assert.deepEqual(middleSegmentIndices(5), [1, 2, 3]);
  });
});

describe("collapsedBreadcrumbMiddle", () => {
  it("shows all middle segments when nothing is hidden", () => {
    assert.deepEqual(collapsedBreadcrumbMiddle(5, 0), {
      showEllipsis: false,
      hiddenMiddleIndices: [],
      visibleMiddleIndices: [1, 2, 3],
    });
  });

  it("hides middle segments from the start and keeps trailing ones", () => {
    assert.deepEqual(collapsedBreadcrumbMiddle(5, 2), {
      showEllipsis: true,
      hiddenMiddleIndices: [1, 2],
      visibleMiddleIndices: [3],
    });
  });

  it("can collapse every middle segment", () => {
    assert.deepEqual(collapsedBreadcrumbMiddle(5, 99), {
      showEllipsis: true,
      hiddenMiddleIndices: [1, 2, 3],
      visibleMiddleIndices: [],
    });
  });
});

describe("pathForBreadcrumbPartIndex", () => {
  it("maps breadcrumb indices to explorer paths", () => {
    const parts = ["alpha", "beta", "gamma"];
    assert.equal(pathForBreadcrumbPartIndex(parts, 0), "alpha");
    assert.equal(pathForBreadcrumbPartIndex(parts, 1), "alpha/beta");
    assert.equal(pathForBreadcrumbPartIndex(parts, 3), "");
  });
});
