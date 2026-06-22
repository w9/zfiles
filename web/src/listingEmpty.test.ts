import assert from "node:assert/strict";
import test from "node:test";

import {
  listingOverlayMessageKey,
  listingPaneOverlayKey,
} from "./listingEmpty";

test("listingOverlayMessageKey is null before first listing load", () => {
  assert.equal(
    listingOverlayMessageKey({
      listingLoaded: false,
      quickFilterActive: false,
      visibleEntryCount: 0,
      filteredEntryCount: 0,
    }),
    null,
  );
});

test("listingOverlayMessageKey is null when filtered entries are visible", () => {
  assert.equal(
    listingOverlayMessageKey({
      listingLoaded: true,
      quickFilterActive: false,
      visibleEntryCount: 3,
      filteredEntryCount: 2,
    }),
    null,
  );
});

test("listingOverlayMessageKey shows folder empty when loaded folder has no entries", () => {
  assert.equal(
    listingOverlayMessageKey({
      listingLoaded: true,
      quickFilterActive: false,
      visibleEntryCount: 0,
      filteredEntryCount: 0,
    }),
    "listing.empty",
  );
});

test("listingOverlayMessageKey shows folder empty when filter is active on empty folder", () => {
  assert.equal(
    listingOverlayMessageKey({
      listingLoaded: true,
      quickFilterActive: true,
      visibleEntryCount: 0,
      filteredEntryCount: 0,
    }),
    "listing.empty",
  );
});

test("listingOverlayMessageKey shows filter empty when filter hides all entries", () => {
  assert.equal(
    listingOverlayMessageKey({
      listingLoaded: true,
      quickFilterActive: true,
      visibleEntryCount: 4,
      filteredEntryCount: 0,
    }),
    "quickFilter.empty",
  );
});

test("listingPaneOverlayKey shows loading while a folder listing is in flight", () => {
  assert.equal(
    listingPaneOverlayKey({
      showListingLoadingOverlay: true,
      listingLoaded: false,
      quickFilterActive: false,
      visibleEntryCount: 0,
      filteredEntryCount: 0,
    }),
    "listing.loading",
  );
});

test("listingPaneOverlayKey prefers loading over empty folder overlay", () => {
  assert.equal(
    listingPaneOverlayKey({
      showListingLoadingOverlay: true,
      listingLoaded: true,
      quickFilterActive: false,
      visibleEntryCount: 0,
      filteredEntryCount: 0,
    }),
    "listing.loading",
  );
});

test("listingPaneOverlayKey falls back to empty overlay when not loading", () => {
  assert.equal(
    listingPaneOverlayKey({
      showListingLoadingOverlay: false,
      listingLoaded: true,
      quickFilterActive: false,
      visibleEntryCount: 0,
      filteredEntryCount: 0,
    }),
    "listing.empty",
  );
});
