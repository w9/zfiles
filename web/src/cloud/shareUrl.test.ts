import assert from "node:assert/strict";
import { test } from "node:test";

import { buildShareUrl, connectionConfigToShareInput } from "./shareUrl";
import type { S3ConnectionConfig } from "./types";

const ORIGIN = "https://files.example.com";
const REPO_BASE = "/zfiles";

test("buildShareUrl emits camelCase params at root", () => {
  const url = buildShareUrl(
    {
      provider: "aws",
      bucket: "my-data",
      region: "us-east-1",
      prefix: "uploads/",
      readOnly: true,
      credentials: {
        accessKeyId: "AKIA123",
        secretAccessKey: "sekret",
        sessionToken: "tok",
      },
    },
    { origin: ORIGIN, includeCredentials: true },
  );
  assert.equal(
    url,
    `${ORIGIN}/?provider=aws&bucket=my-data&region=us-east-1&prefix=uploads%2F&readOnly=true&accessKeyId=AKIA123&secretAccessKey=sekret&sessionToken=tok`,
  );
});

test("buildShareUrl includes explorer path in pathname", () => {
  const url = buildShareUrl(
    {
      provider: "r2",
      bucket: "photos",
      endpoint: "https://acct.r2.cloudflarestorage.com",
    },
    { origin: ORIGIN, explorerPath: "2024/album" },
  );
  assert.equal(
    url,
    `${ORIGIN}/f/2024/album?provider=r2&bucket=photos&endpoint=https%3A%2F%2Facct.r2.cloudflarestorage.com`,
  );
});

test("buildShareUrl omits credentials when disabled", () => {
  const url = buildShareUrl(
    {
      bucket: "data",
      credentials: {
        accessKeyId: "AKIA123",
        secretAccessKey: "sekret",
      },
    },
    { origin: ORIGIN, includeCredentials: false },
  );
  assert.equal(url, `${ORIGIN}/?bucket=data`);
  assert.doesNotMatch(url, /accessKeyId|secretAccessKey/);
});

test("buildShareUrl omits empty optional fields", () => {
  const url = buildShareUrl({ provider: "aws" }, { origin: ORIGIN });
  assert.equal(url, `${ORIGIN}/?provider=aws`);
});

test("buildShareUrl respects app base subpath", () => {
  const url = buildShareUrl(
    { bucket: "docs" },
    { origin: ORIGIN, base: REPO_BASE, explorerPath: "readme" },
  );
  assert.equal(url, `${ORIGIN}${REPO_BASE}/f/readme?bucket=docs`);
});

test("connectionConfigToShareInput maps session config", () => {
  const config: S3ConnectionConfig = {
    provider: "aws",
    bucket: "b",
    region: "eu-west-1",
    prefix: "p/",
    readOnly: false,
    credentials: {
      accessKeyId: "id",
      secretAccessKey: "secret",
    },
  };
  assert.deepEqual(connectionConfigToShareInput(config), {
    provider: "aws",
    bucket: "b",
    region: "eu-west-1",
    endpoint: undefined,
    prefix: "p/",
    readOnly: false,
    credentials: {
      accessKeyId: "id",
      secretAccessKey: "secret",
    },
  });
});
