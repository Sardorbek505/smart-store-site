import test from "node:test";
import assert from "node:assert/strict";
import { cleanLabel, isDownload } from "../scripts/analytics.js";

const link = (attrs) => ({
  matches: (selector) =>
    selector.split(",").some((part) => {
      const s = part.trim();
      return (s === "#download" && attrs.id === "download") ||
        (s === "[data-download]" && "data-download" in attrs) ||
        (s === "#start-download" && attrs.id === "start-download");
    }),
  getAttribute: (name) => attrs[name] ?? null,
});

test("labels are one short line", () => {
  assert.equal(cleanLabel("  Попробовать\n   бесплатно "), "Попробовать бесплатно");
  assert.equal(cleanLabel("а".repeat(100)).length, 70);
  assert.equal(cleanLabel(undefined), "");
  assert.equal(cleanLabel("Открыть демо Открыть демо"), "Открыть демо");
});

test("download buttons are recognised for the funnel", () => {
  assert.equal(isDownload(link({ id: "download" })), true);
  assert.equal(isDownload(link({ "data-download": "" })), true);
  assert.equal(
    isDownload(link({ href: "https://github.com/Sardorbek505/smart-store-releases/releases/latest" })),
    true,
  );
  assert.equal(isDownload(link({ href: "#faq" })), false);
});
