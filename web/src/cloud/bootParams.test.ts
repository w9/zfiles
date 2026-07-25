import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detectBootMode,
  parseConnectIntent,
  readBootParamsFromSearch,
  readBootRequest,
  stripBootCredentialsFromSearch,
  stripCredentialParamsFromSearch,
} from "./bootParams";

test("readBootParamsFromSearch parses non-secret params", () => {
  assert.deepEqual(
    readBootParamsFromSearch(
      "?provider=r2&bucket=photos&region=auto&endpoint=https://example.r2.cloudflarestorage.com&prefix=uploads/&readonly=1",
    ),
    {
      provider: "r2",
      bucket: "photos",
      region: "auto",
      endpoint: "https://example.r2.cloudflarestorage.com",
      prefix: "uploads/",
      readOnly: true,
      accessKeyId: undefined,
      secretAccessKey: undefined,
      sessionToken: undefined,
    },
  );
});

test("readBootParamsFromSearch ignores unknown provider", () => {
  assert.equal(readBootParamsFromSearch("?provider=wasabi").provider, undefined);
});

test("readBootParamsFromSearch parses credential params", () => {
  assert.deepEqual(
    readBootParamsFromSearch(
      "?bucket=data&access_key_id=AKIA123&secret_access_key=sekret&session_token=tok",
    ),
    {
      provider: undefined,
      bucket: "data",
      region: undefined,
      endpoint: undefined,
      prefix: undefined,
      readOnly: undefined,
      accessKeyId: "AKIA123",
      secretAccessKey: "sekret",
      sessionToken: "tok",
    },
  );
});

test("readBootParamsFromSearch accepts readOnly camelCase alias", () => {
  assert.equal(readBootParamsFromSearch("?readOnly=true").readOnly, true);
});

test("readBootParamsFromSearch prefers camelCase credential aliases", () => {
  assert.equal(
    readBootParamsFromSearch("?accessKeyId=camel&access_key_id=snake").accessKeyId,
    "camel",
  );
});

test("stripCredentialParamsFromSearch removes credential params and keeps others", () => {
  const url = new URL(
    "https://files.example.com/?provider=aws&bucket=photos&accessKeyId=AKIA&secretAccessKey=sek&prefix=2024/",
  );
  assert.equal(
    stripCredentialParamsFromSearch(url),
    "/?provider=aws&bucket=photos&prefix=2024%2F",
  );
});

test("detectBootMode defaults to local in tests", () => {
  assert.equal(detectBootMode(), "local");
});

test("parseConnectIntent reads namespaced intents", () => {
  assert.deepEqual(parseConnectIntent("saved:My%20Bucket"), {
    kind: "saved",
    name: "My Bucket",
  });
  assert.deepEqual(parseConnectIntent("saved: Spaced Name "), {
    kind: "saved",
    name: "Spaced Name",
  });
  assert.deepEqual(parseConnectIntent("new"), { kind: "new" });
  assert.deepEqual(parseConnectIntent("ask"), { kind: "ask" });
  assert.deepEqual(parseConnectIntent("ASK"), { kind: "ask" });
});

test("parseConnectIntent ignores unknown or empty intents", () => {
  assert.equal(parseConnectIntent(null), null);
  assert.equal(parseConnectIntent(""), null);
  assert.equal(parseConnectIntent("bogus"), null);
  assert.equal(parseConnectIntent("saved:"), null);
  assert.equal(parseConnectIntent("saved:   "), null);
});

test("readBootRequest takes credentials from the fragment", () => {
  const request = readBootRequest(
    "?connect=new&bucket=data&region=auto",
    "#accessKeyId=AKIA&secretAccessKey=sekret&sessionToken=tok",
  );

  assert.deepEqual(request.intent, { kind: "new" });
  assert.equal(request.params.bucket, "data");
  assert.equal(request.params.region, "auto");
  assert.equal(request.params.accessKeyId, "AKIA");
  assert.equal(request.params.secretAccessKey, "sekret");
  assert.equal(request.params.sessionToken, "tok");
});

test("readBootRequest prefers fragment credentials over query params", () => {
  const request = readBootRequest(
    "?connect=new&bucket=data&accessKeyId=from-query&secretAccessKey=from-query",
    "#accessKeyId=from-hash&secretAccessKey=from-hash",
  );

  assert.equal(request.params.accessKeyId, "from-hash");
  assert.equal(request.params.secretAccessKey, "from-hash");
});

test("readBootRequest still accepts credential query params alone", () => {
  const request = readBootRequest("?connect=new&bucket=data&access_key_id=AKIA", "");
  assert.equal(request.params.accessKeyId, "AKIA");
});

test("readBootRequest reports a saved connection by name", () => {
  const request = readBootRequest("?connect=saved:Work%20bucket", "");
  assert.deepEqual(request.intent, { kind: "saved", name: "Work bucket" });
});

test("stripBootCredentialsFromSearch removes credential params and fragment", () => {
  const url = new URL(
    "https://files.example.com/f/photos?connect=new&bucket=photos&accessKeyId=AKIA#secretAccessKey=sek",
  );
  assert.equal(
    stripBootCredentialsFromSearch(url),
    "/f/photos?connect=new&bucket=photos",
  );
});

test("stripBootCredentialsFromSearch keeps a fragment that holds no credentials", () => {
  const url = new URL("https://files.example.com/f/photos?bucket=photos#section");
  assert.equal(stripBootCredentialsFromSearch(url), "/f/photos?bucket=photos#section");
});
