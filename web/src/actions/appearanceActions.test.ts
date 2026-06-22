import assert from "node:assert/strict";
import test from "node:test";

import { defaultContextKeys } from "./contextKeys";
import { createAppearanceActions } from "./appearanceActions";
import { evaluateWhen } from "./when";

test("appearance cycle actions are always available", () => {
  const actions = createAppearanceActions(() => ({
    getThemeMode: () => "auto",
    setThemeMode: () => {},
    getUiMode: () => "auto",
    setUiMode: () => {},
    getLocale: () => "en",
    setLocale: () => {},
  }));
  for (const action of actions.filter((item) => item.id.includes("cycle"))) {
    assert.equal(evaluateWhen(action.when, defaultContextKeys()), true);
  }
});

test("appearance.set-locale accepts locale arg", async () => {
  let locale = "en";
  const action = createAppearanceActions(() => ({
    getThemeMode: () => "auto",
    setThemeMode: () => {},
    getUiMode: () => "auto",
    setUiMode: () => {},
    getLocale: () => locale,
    setLocale: (next) => {
      locale = next;
    },
  })).find((item) => item.id === "appearance.set-locale");
  assert.ok(action);
  await action!.handler(defaultContextKeys(), { locale: "de" });
  assert.equal(locale, "de");
});
