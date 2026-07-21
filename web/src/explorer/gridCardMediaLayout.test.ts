import assert from "node:assert/strict";
import test from "node:test";

import {
  GRID_CARD_MEDIA_OBJECT_CLASS,
  GRID_CARD_MEDIA_SHELL_CLASS,
  GRID_CARD_MEDIA_SLOT_CLASS,
} from "./gridCardMediaLayout";

test("grid card media slot is a height-bound flex column", () => {
  assert.match(GRID_CARD_MEDIA_SLOT_CLASS, /\bflex\b/);
  assert.match(GRID_CARD_MEDIA_SLOT_CLASS, /\bflex-col\b/);
  assert.match(GRID_CARD_MEDIA_SLOT_CLASS, /\bflex-1\b/);
  assert.match(GRID_CARD_MEDIA_SLOT_CLASS, /\bmin-h-0\b/);
  assert.match(GRID_CARD_MEDIA_SLOT_CLASS, /\boverflow-hidden\b/);
});

test("grid card media shell fills the slot and centers content", () => {
  assert.match(GRID_CARD_MEDIA_SHELL_CLASS, /\bh-full\b/);
  assert.match(GRID_CARD_MEDIA_SHELL_CLASS, /\bw-full\b/);
  assert.match(GRID_CARD_MEDIA_SHELL_CLASS, /\bitems-center\b/);
  assert.match(GRID_CARD_MEDIA_SHELL_CLASS, /\bjustify-center\b/);
  assert.match(GRID_CARD_MEDIA_SHELL_CLASS, /\boverflow-hidden\b/);
  assert.match(GRID_CARD_MEDIA_SHELL_CLASS, /\bmin-h-0\b/);
});

test("grid card media object letterboxes inside the shell", () => {
  assert.match(GRID_CARD_MEDIA_OBJECT_CLASS, /\bh-full\b/);
  assert.match(GRID_CARD_MEDIA_OBJECT_CLASS, /\bw-full\b/);
  assert.match(GRID_CARD_MEDIA_OBJECT_CLASS, /\bobject-contain\b/);
  assert.doesNotMatch(GRID_CARD_MEDIA_OBJECT_CLASS, /\bobject-cover\b/);
});
