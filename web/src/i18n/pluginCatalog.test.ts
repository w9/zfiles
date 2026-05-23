import assert from "node:assert/strict";
import test from "node:test";

import {
  clearPluginCatalogs,
  loadPluginCatalogs,
  mergePluginCatalog,
  translatePlugin,
} from "./pluginCatalog";
import { translate } from "./messages";

test("translate resolves plugin catalog keys", () => {
  clearPluginCatalogs();
  mergePluginCatalog("en", {
    "plugin.image-thumbnailer.actions.slideshow.name": "Slideshow",
  });
  assert.equal(
    translate("en", "plugin.image-thumbnailer.actions.slideshow.name" as never),
    "Slideshow",
  );
  assert.equal(
    translatePlugin("en", "plugin.image-thumbnailer.actions.slideshow.name"),
    "Slideshow",
  );
});

test("loadPluginCatalogs merges server bundles", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        "image-thumbnailer": {
          en: { "plugin.image-thumbnailer.actions.slideshow.name": "Slideshow" },
          "zh-CN": { "plugin.image-thumbnailer.actions.slideshow.name": "幻灯片" },
        },
      }),
    }) as Response;

  try {
    await loadPluginCatalogs();
    assert.equal(
      translatePlugin("zh-CN", "plugin.image-thumbnailer.actions.slideshow.name"),
      "幻灯片",
    );
  } finally {
    globalThis.fetch = previousFetch;
    clearPluginCatalogs();
  }
});
