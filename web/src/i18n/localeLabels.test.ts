import assert from "node:assert/strict";
import test from "node:test";

import {
  isLocaleArgAction,
  LOCALE_ARG_ACTION_ID,
  LOCALE_LABEL_KEYS,
} from "./localeLabels";
import { SUPPORTED_LOCALES } from "./messages";

test("LOCALE_LABEL_KEYS covers every supported locale", () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.ok(LOCALE_LABEL_KEYS[locale], `missing label key for ${locale}`);
  }
});

test("isLocaleArgAction matches appearance.set-locale only", () => {
  assert.equal(isLocaleArgAction(LOCALE_ARG_ACTION_ID), true);
  assert.equal(isLocaleArgAction("appearance.set-theme"), false);
  assert.equal(isLocaleArgAction(null), false);
});
