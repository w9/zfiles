import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canEntryMediaPreviewImage,
  canEntryMediaPreviewVideo,
  entryMediaVideoChrome,
} from "./mediaPreviewPolicy";

test("canEntryMediaPreviewImage gates on setting, directory, and extension", () => {
  assert.equal(canEntryMediaPreviewImage("photo.jpg", false, true), true);
  assert.equal(canEntryMediaPreviewImage("photo.jpg", false, false), false);
  assert.equal(canEntryMediaPreviewImage("photo.jpg", true, true), false);
  assert.equal(canEntryMediaPreviewImage("notes.txt", false, true), false);
});

test("canEntryMediaPreviewVideo gates on setting, directory, and extension", () => {
  assert.equal(canEntryMediaPreviewVideo("clip.mp4", false, true), true);
  assert.equal(canEntryMediaPreviewVideo("clip.mp4", false, false), false);
  assert.equal(canEntryMediaPreviewVideo("clip.mp4", true, true), false);
  assert.equal(canEntryMediaPreviewVideo("photo.jpg", false, true), false);
});

test("entryMediaVideoChrome is off when badge disabled or preview not ready", () => {
  assert.deepEqual(
    entryMediaVideoChrome("grid", {
      badgeEnabled: false,
      showVideoPreview: true,
      loaded: true,
      failed: false,
    }),
    { showPlay: false, showDuration: false },
  );
  assert.deepEqual(
    entryMediaVideoChrome("list", {
      badgeEnabled: true,
      showVideoPreview: true,
      loaded: false,
      failed: false,
    }),
    { showPlay: false, showDuration: false },
  );
  assert.deepEqual(
    entryMediaVideoChrome("grid", {
      badgeEnabled: true,
      showVideoPreview: true,
      loaded: true,
      failed: true,
    }),
    { showPlay: false, showDuration: false },
  );
});

test("entryMediaVideoChrome is play-only in list and play+duration in grid", () => {
  assert.deepEqual(
    entryMediaVideoChrome("list", {
      badgeEnabled: true,
      showVideoPreview: true,
      loaded: true,
      failed: false,
    }),
    { showPlay: true, showDuration: false },
  );
  assert.deepEqual(
    entryMediaVideoChrome("grid", {
      badgeEnabled: true,
      showVideoPreview: true,
      loaded: true,
      failed: false,
    }),
    { showPlay: true, showDuration: true },
  );
});
