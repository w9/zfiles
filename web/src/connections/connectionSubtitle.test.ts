import assert from "node:assert/strict";
import test from "node:test";

import { connectionSubtitle } from "./connectionSubtitle";
import type { ConnectionRecord } from "./types";

function s3Connection(
  settings: NonNullable<ConnectionRecord["settings"]>,
): ConnectionRecord {
  return {
    id: "id-1",
    kind: "s3",
    name: "Connection",
    createdAt: 0,
    rememberKeys: false,
    settings,
  };
}

test("connectionSubtitle uses the bucket when there is no prefix or endpoint", () => {
  assert.equal(
    connectionSubtitle(
      s3Connection({
        provider: "aws",
        bucket: "my-data",
        region: "us-east-1",
        prefix: "",
        readOnly: false,
      }),
    ),
    "my-data",
  );
});

test("connectionSubtitle includes a trimmed prefix", () => {
  assert.equal(
    connectionSubtitle(
      s3Connection({
        provider: "aws",
        bucket: "my-data",
        region: "us-east-1",
        prefix: "/photos/",
        readOnly: false,
      }),
    ),
    "my-data/photos",
  );
});

test("connectionSubtitle appends the endpoint host without growing for the path", () => {
  const host = "7bfd46bdb32cf54027c7c2c781baef77.r2.cloudflarestorage.com";
  assert.equal(
    connectionSubtitle(
      s3Connection({
        provider: "r2",
        bucket: "test",
        region: "auto",
        endpoint: `https://${host}/account`,
        prefix: "",
        readOnly: false,
      }),
    ),
    `test · ${host}`,
  );
});

test("connectionSubtitle returns null for non-s3 connections", () => {
  assert.equal(
    connectionSubtitle({
      id: "browser",
      kind: "browser",
      name: "Browser storage",
      createdAt: 0,
      rememberKeys: false,
    }),
    null,
  );
});
