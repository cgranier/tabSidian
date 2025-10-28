import test from "node:test";
import assert from "node:assert/strict";
import { shouldProcessTab, sanitizeRestrictedUrls, isRestrictedUrl, resolveTabUrl } from "../src/platform/tabFilters.js";

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

test("resolveTabUrl prefers pending URL for discarded internal tabs", () => {
  const tab = {
    discarded: true,
    url: "chrome://discarded",
    pendingUrl: "https://docs.arc.net/welcome"
  };

  assert.equal(resolveTabUrl(tab), "https://docs.arc.net/welcome");
});

test("resolveTabUrl parses embedded discarded URL fragments", () => {
  const tab = {
    discarded: true,
    url: "chrome://discarded/https://example.com/projects",
    pendingUrl: ""
  };

  assert.equal(resolveTabUrl(tab), "https://example.com/projects");
});

test("resolveTabUrl decodes discarded query parameters", () => {
  const tab = {
    discarded: true,
    url: "chrome://discarded?url=https%3A%2F%2Fexample.com%2Fencoded",
    pendingUrl: ""
  };

  assert.equal(resolveTabUrl(tab), "https://example.com/encoded");
});

test("shouldProcessTab includes discarded tabs with fallback URLs", () => {
  const tab = {
    discarded: true,
    pinned: false,
    highlighted: true,
    url: "chrome://discarded",
    pendingUrl: "https://example.com/page"
  };

  assert.equal(shouldProcessTab(tab, [], false), true);
});

test("shouldProcessTab includes discarded tabs extracted from placeholders", () => {
  const tab = {
    discarded: true,
    pinned: false,
    highlighted: true,
    url: "chrome://discarded/https://example.com/from-placeholder",
    pendingUrl: ""
  };

  assert.equal(shouldProcessTab(tab, [], false), true);
});

test("shouldProcessTab still filters discarded tabs when fallback is restricted", () => {
  const tab = {
    discarded: true,
    pinned: false,
    highlighted: true,
    url: "chrome://discarded",
    pendingUrl: "https://mail.google.com/inbox"
  };

  assert.equal(shouldProcessTab(tab, ["mail.google.com"], false), false);
});

test("shouldProcessTab filters extracted placeholder URLs when restricted", () => {
  const tab = {
    discarded: true,
    pinned: false,
    highlighted: true,
    url: "chrome://discarded/https://mail.google.com/inbox",
    pendingUrl: ""
  };

  assert.equal(shouldProcessTab(tab, ["mail.google.com"], false), false);
});

test("isRestrictedUrl detects internal and user-defined patterns", () => {
  assert.equal(isRestrictedUrl("chrome://settings", []), true);
  assert.equal(isRestrictedUrl("https://mail.google.com/inbox", ["mail.google.com"]), true);
  assert.equal(isRestrictedUrl("https://example.com", ["mail.google.com"]), false);
});
