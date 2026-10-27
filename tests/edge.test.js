import test from "node:test";
import assert from "node:assert/strict";
import worker from "../edge/worker.js";
import { publicFiles } from "../tools/build-edge.mjs";

test("edge redirects legacy, www and directory URLs in one step", async () => {
  const noOrigin = {
    ASSETS: {
      fetch() {
        throw Error("must not fetch");
      },
    },
  };
  for (const [source, target] of [
    [
      "http://www.metov.store/demo/?source=test",
      "https://metov.store/#workspace",
    ],
    ["https://metov.store/index.html", "https://metov.store/"],
    [
      "https://www.metov.store/programma-dlya-magazina-instrumentov/index.html",
      "https://metov.store/programma-dlya-magazina-instrumentov/",
    ],
  ]) {
    const response = await worker.fetch(new Request(source), noOrigin);
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), target);
  }
});

test("edge preserves HTML canonical paths, custom 404 and existing CSP", async () => {
  const paths = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        paths.push(new URL(request.url).pathname);
        return new Response("fixture", {
          status: paths.at(-1).includes("missing") ? 404 : 200,
          headers: { "Content-Security-Policy": "script-src 'self'" },
        });
      },
    },
  };
  for (const path of [
    "/",
    "/privacy.html",
    "/programma-dlya-magazina-instrumentov/",
    "/missing/",
  ]) {
    const response = await worker.fetch(
      new Request(`https://metov.store${path}`),
      env,
    );
    assert.equal(response.status, path.includes("missing") ? 404 : 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.ok(
      response.headers
        .get("content-security-policy")
        .includes("script-src 'self'"),
    );
    assert.ok(
      response.headers
        .get("content-security-policy")
        .includes("frame-ancestors 'none'"),
    );
    assert.equal(
      response.headers.get("strict-transport-security"),
      "max-age=15552000",
    );
  }
  assert.deepEqual(paths, [
    "/index.html",
    "/privacy.html",
    "/programma-dlya-magazina-instrumentov/index.html",
    "/missing/index.html",
  ]);
});

test("edge respects HEAD, caches only immutable assets, protects previews and handles origin failure", async () => {
  const env = { ASSETS: { fetch: async () => new Response("fixture") } };
  const head = await worker.fetch(
    new Request("https://metov.store/", { method: "HEAD" }),
    env,
  );
  assert.equal(await head.text(), "");
  const asset = await worker.fetch(
    new Request("https://metov.store/assets/site.123456abcdef.css"),
    env,
  );
  assert.ok(asset.headers.get("cache-control").includes("immutable"));
  const preview = await worker.fetch(
    new Request("https://preview.workers.dev/privacy.html"),
    env,
  );
  assert.equal(preview.headers.get("x-robots-tag"), "noindex");
  assert.equal(
    (
      await worker.fetch(
        new Request("https://metov.store/", { method: "POST" }),
        env,
      )
    ).status,
    405,
  );
  const failure = await worker.fetch(new Request("https://metov.store/"), {
    ASSETS: {
      fetch() {
        throw Error("offline");
      },
    },
  });
  assert.equal(failure.status, 503);
  assert.equal(failure.headers.get("cache-control"), "no-store");
});

test("edge package excludes development files and preserves proofs and original screens", async () => {
  const files = await publicFiles();
  assert.ok(files.includes("privacy.html"));
  assert.ok(files.includes("img/demo-sale.png"));
  assert.ok(files.includes("yandex_3ab61845d04cfe19.html"));
  assert.ok(
    files.every(
      (path) =>
        !/^(?:docs|tests|tools|node_modules|edge)\//.test(path) &&
        !path.endsWith(".map") &&
        !path.includes(".env"),
    ),
  );
});
