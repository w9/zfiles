import assert from "node:assert/strict";
import { test } from "node:test";

import { buildShareUrl, connectionConfigToShareInput } from "./shareUrl";
import { readBootRequest } from "./bootParams";
import type { S3ConnectionConfig } from "./types";

const ORIGIN = "https://files.example.com";
const REPO_BASE = "/zfiles";

test("buildShareUrl asks the recipient to connect and keeps secrets in the fragment", () => {
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
    `${ORIGIN}/?connect=new&provider=aws&bucket=my-data&region=us-east-1&prefix=uploads%2F&readOnly=true#accessKeyId=AKIA123&secretAccessKey=sekret&sessionToken=tok`,
  );
});

test("a shared link round-trips through the boot request parser", () => {
  const url = new URL(
    buildShareUrl(
      {
        provider: "r2",
        bucket: "photos",
        endpoint: "https://acct.r2.cloudflarestorage.com",
        credentials: { accessKeyId: "AKIA", secretAccessKey: "sekret" },
      },
      { origin: ORIGIN, explorerPath: "2024/album", includeCredentials: true },
    ),
  );

  const request = readBootRequest(url.search, url.hash);
  assert.deepEqual(request.intent, { kind: "new" });
  assert.equal(request.params.bucket, "photos");
  assert.equal(request.params.endpoint, "https://acct.r2.cloudflarestorage.com");
  assert.equal(request.params.accessKeyId, "AKIA");
  assert.equal(request.params.secretAccessKey, "sekret");
  assert.equal(url.pathname, "/f/2024/album");
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
  assert.equal(url, `${ORIGIN}/?connect=new&bucket=data`);
  assert.doesNotMatch(url, /accessKeyId|secretAccessKey/);
});

test("buildShareUrl omits empty optional fields", () => {
  const url = buildShareUrl({ provider: "aws" }, { origin: ORIGIN });
  assert.equal(url, `${ORIGIN}/?connect=new&provider=aws`);
});

test("buildShareUrl respects app base subpath", () => {
  const url = buildShareUrl(
    { bucket: "docs" },
    { origin: ORIGIN, base: REPO_BASE, explorerPath: "readme" },
  );
  assert.equal(url, `${ORIGIN}${REPO_BASE}/f/readme?connect=new&bucket=docs`);
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
