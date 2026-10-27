import test from "node:test";
import assert from "node:assert/strict";
import { createDiagnostics } from "../scripts/diagnostics.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(allow = () => true, fetcher) {
  const sent = [],
    host = new EventTarget();
  const report = createDiagnostics({
    host,
    analyticsAllowed: allow,
    version: "63",
    fetcher:
      fetcher ||
      ((url, options) => {
        sent.push({ url, ...options });
        return Promise.resolve();
      }),
  });
  return { report, sent, host };
}

test("diagnostics accept only known categories, deduplicate and cap five reports", async () => {
  const { report, sent } = fixture();
  for (const code of [
    "module:store",
    "module:store",
    "module:downloads",
    "runtime:exception",
    "runtime:rejection",
    "module:gallery",
    "module:media",
    "module:private-password",
    "https://private.example/?secret=1",
  ])
    report(code);
  await tick();
  assert.equal(sent.length, 5);
  assert.deepEqual(JSON.parse(sent[0].body), {
    site: "smart-store",
    name: "error",
    label: "v63:module:store",
  });
  assert.equal(sent[0].credentials, "omit");
  assert.equal(sent[0].referrerPolicy, "no-referrer");
  assert.ok(sent.every((item) => !item.body.includes("private")));
});

test("opt-out stops reports even after monitoring has started; network errors stay silent", async () => {
  let allowed = false;
  const { report, sent } = fixture(() => allowed);
  report("module:store");
  assert.equal(sent.length, 0);
  allowed = true;
  report("module:store");
  assert.equal(sent.length, 1);
  allowed = false;
  report("module:gallery");
  assert.equal(sent.length, 1);
  const rejected = fixture(
    () => true,
    () => Promise.reject(new Error("offline")),
  );
  const thrown = fixture(
    () => true,
    () => {
      throw Error("offline");
    },
  );
  assert.doesNotThrow(() => rejected.report("module:store"));
  assert.doesNotThrow(() => thrown.report("module:store"));
  await tick();
});

test("global handlers ignore cancellation and never serialize an exception", async () => {
  const { host, sent } = fixture();
  const aborted = new Event("unhandledrejection");
  aborted.reason = { name: "AbortError", message: "private cancellation" };
  host.dispatchEvent(aborted);
  const rejected = new Event("unhandledrejection");
  rejected.reason = {
    name: "Error",
    message: "private password",
    stack: "https://example.org/?token=private",
  };
  host.dispatchEvent(rejected);
  const failed = new Event("error");
  failed.message = "private code";
  host.dispatchEvent(failed);
  await tick();
  assert.deepEqual(
    sent.map((item) => JSON.parse(item.body).label),
    ["v63:runtime:rejection", "v63:runtime:exception"],
  );
  assert.ok(sent.every((item) => !item.body.includes("private")));
});
