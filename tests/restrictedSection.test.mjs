import test from "node:test";
import assert from "node:assert/strict";
import { parseRestrictedUrlsImportText, resolveRestrictedUrlsOnLoad } from "../src/options/sections/restricted.js";

test("parseRestrictedUrlsImportText parses JSON arrays", () => {
  const entries = parseRestrictedUrlsImportText('["mail.google.com","example.com"]');
  assert.deepEqual(entries, ["mail.google.com", "example.com"]);
});

test("parseRestrictedUrlsImportText falls back to newline text", () => {
  const entries = parseRestrictedUrlsImportText("mail.google.com\n\nexample.com\n");
  assert.deepEqual(entries, ["mail.google.com", "example.com"]);
});

test("resolveRestrictedUrlsOnLoad keeps intentionally empty stored list", () => {
  const result = resolveRestrictedUrlsOnLoad({
    storedRestrictedUrls: [],
    defaultRestrictedUrls: ["default.com"],
    legacyDefaultRestrictedUrls: ["legacy.com"]
  });
  assert.deepEqual(result.restrictedUrls, []);
  assert.equal(result.shouldPersistDefaults, false);
});

test("resolveRestrictedUrlsOnLoad falls back to defaults when key missing", () => {
  const result = resolveRestrictedUrlsOnLoad({
    storedRestrictedUrls: undefined,
    defaultRestrictedUrls: ["default.com"],
    legacyDefaultRestrictedUrls: ["legacy.com"]
  });
  assert.deepEqual(result.restrictedUrls, ["default.com"]);
  assert.equal(result.shouldPersistDefaults, true);
});
