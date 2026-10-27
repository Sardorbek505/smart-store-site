import test from "node:test";
import assert from "node:assert/strict";
import {
  config,
  storeCode,
  storeUrl,
  installerFromRelease,
  fetchJson,
} from "../scripts/core.js";

const release = () => ({
  draft: false,
  prerelease: false,
  tag_name: "v1.29.4",
  assets: [
    {
      name: "SmartStore-Setup-1.29.4-x64.exe",
      size: 167772160,
      browser_download_url: `https://github.com/${config.releaseRepository}/releases/download/v1.29.4/SmartStore-Setup-1.29.4-x64.exe`,
    },
  ],
});
test("store addresses are normalized only within the store domain", () => {
  for (const value of [
    " DeMO-42 ",
    "demo-42.metov.store",
    "https://DEMO-42.metov.store/phone?tab=home",
  ]) {
    assert.equal(storeCode(value), "demo-42");
    assert.equal(storeUrl(value), "https://demo-42.metov.store/");
  }
});
test("foreign hosts, credentials, nested subdomains and reserved addresses cannot become login targets", () => {
  for (const value of [
    null,
    42,
    "",
    "a",
    "-aa",
    "aa-",
    "a".repeat(41),
    "www",
    "connect",
    "api",
    "admin",
    "zavod",
    "https://zavod.metov.store/",
    "evil.example",
    "https://demo.metov.store.evil.example/",
    "https://evil.example/demo.metov.store",
    "https://user:pass@demo.metov.store/",
    "http://demo.metov.store/",
    "https://demo.metov.store:8443/",
    "https://one.two.metov.store/",
    "https://metov.store/",
    "https://demo.metov.store@evil.example/",
    "javascript:alert(1)",
  ]) {
    assert.equal(storeCode(value), null, String(value));
    assert.equal(storeUrl(value), null, String(value));
  }
});
test("only the exact stable Windows installer is accepted", () => {
  assert.deepEqual(installerFromRelease(release()), {
    version: "1.29.4",
    url: release().assets[0].browser_download_url,
    size: 167772160,
  });
  const variations = [
    { draft: true },
    { prerelease: true },
    { tag_name: "v1.29.4-beta" },
    { assets: null },
    { assets: [{ ...release().assets[0], name: "another.exe" }] },
    {
      assets: [
        {
          ...release().assets[0],
          browser_download_url: "https://evil.example/installer.exe",
        },
      ],
    },
    { assets: [{ ...release().assets[0], size: 0 }] },
    { assets: [{ ...release().assets[0], size: "160" }] },
  ];
  for (const patch of variations)
    assert.equal(installerFromRelease({ ...release(), ...patch }), null);
  assert.equal(installerFromRelease(null), null);
});
test("service failures and invalid JSON remain failures", async () => {
  await assert.rejects(
    fetchJson("https://example.invalid", {
      fetcher: async () => ({ ok: false }),
    }),
  );
  await assert.rejects(
    fetchJson("https://example.invalid", {
      fetcher: async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError("Invalid JSON");
        },
      }),
    }),
  );
});
const abortable = (_url, { signal }) =>
  new Promise((_resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
  });
test("network deadline and caller cancellation both stop pending requests", async () => {
  await assert.rejects(
    fetchJson("https://example.invalid", { timeout: 15, fetcher: abortable }),
    { name: "AbortError" },
  );
  const controller = new AbortController();
  const request = fetchJson("https://example.invalid", {
    timeout: 1000,
    signal: controller.signal,
    fetcher: abortable,
  });
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    fetchJson("https://example.invalid", {
      signal: cancelled.signal,
      fetcher: abortable,
    }),
    { name: "AbortError" },
  );
});
test("the deadline covers a stalled response body too", async () => {
  await assert.rejects(
    fetchJson("https://example.invalid", {
      timeout: 15,
      fetcher: async (_url, { signal }) => ({
        ok: true,
        json: () => abortable(_url, { signal }),
      }),
    }),
    { name: "AbortError" },
  );
});
