import test from "node:test";
import assert from "node:assert/strict";
import {
  analyticsAllowed,
  browserPrivacySignal,
  referrerOrigin,
} from "../scripts/core.js";

test("tracking respects stored choices, privacy signals and unavailable storage", () => {
  assert.equal(
    analyticsAllowed({}, () => null),
    true,
  );
  assert.equal(
    analyticsAllowed({}, () => "off"),
    false,
  );
  for (const nav of [
    { doNotTrack: "1" },
    { doNotTrack: "yes" },
    { globalPrivacyControl: true },
    { webdriver: true },
  ])
    assert.equal(
      analyticsAllowed(nav, () => "on"),
      false,
    );
  assert.equal(
    analyticsAllowed({}, () => {
      throw new Error("Storage unavailable");
    }),
    false,
  );
  assert.equal(browserPrivacySignal({ doNotTrack: "0" }), false);
});

test("only the referrer origin reaches the visit counter", () => {
  assert.equal(
    referrerOrigin("https://example.org/private?email=private#secret"),
    "https://example.org",
  );
  for (const value of [
    "",
    "invalid",
    "javascript:alert(1)",
    "data:text/plain,secret",
  ])
    assert.equal(referrerOrigin(value), "");
});
