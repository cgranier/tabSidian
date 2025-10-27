import test from "node:test";
import assert from "node:assert/strict";
import { shouldProcessTab, sanitizeRestrictedUrls, isRestrictedUrl } from "../src/platform/tabFilters.js";

test("sanitizeRestrictedUrls removes empty values", () => {
  const result = sanitizeRestrictedUrls(["example.com", "", "   ", null, "docs"]);
  assert.deepEqual(result, ["example.com", "docs"]);
});

test("shouldProcessTab skips pinned tabs", () => {
  const tab = { pinned: true, url: "https://example.com" };
  assert.equal(shouldProcessTab(tab, [], false), false);
});

test("shouldProcessTab respects highlighted tabs when multiple are selected", () => {
  const restricted = [];
  const tabs = [
    { highlighted: false, pinned: false, url: "https://a.com" },
    { highlighted: true, pinned: false, url: "https://b.com" }
  ];

  assert.equal(shouldProcessTab(tabs[0], restricted, true), false);
  assert.equal(shouldProcessTab(tabs[1], restricted, true), true);
});

test("shouldProcessTab filters restricted URLs", () => {
  const tab = { highlighted: true, pinned: false, url: "https://mail.google.com" };
  assert.equal(shouldProcessTab(tab, ["mail.google.com"], false), false);
});

test("isRestrictedUrl detects internal and user-defined patterns", () => {
  assert.equal(isRestrictedUrl("chrome://settings", []), true);
  assert.equal(isRestrictedUrl("https://mail.google.com/inbox", ["mail.google.com"]), true);
  assert.equal(isRestrictedUrl("https://example.com", ["mail.google.com"]), false);
});
