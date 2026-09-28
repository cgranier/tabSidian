import test from "node:test";
import assert from "node:assert/strict";
import { validateExport } from "../src/platform/exportValidator.js";

const tabs = [{ url: "https://example.com/" }, { url: "https://example.org/page" }, { url: "https://example.com/" }];

test("validateExport rejects empty or whitespace-only exports", () => {
  assert.equal(validateExport({ markdown: "", tabs }).ok, false);
  assert.equal(validateExport({ markdown: "  \n ", tabs }).reason, "empty_export");
  assert.equal(validateExport({ markdown: undefined, tabs }).ok, false);
});

test("validateExport reports full URL coverage", () => {
  const result = validateExport({ markdown: "- https://example.com/\n- https://example.org/page", tabs });
  assert.equal(result.ok, true);
  assert.equal(result.coverage, 1);
  assert.deepEqual(result.missingUrls, []);
});

test("validateExport reports missing URLs without failing custom templates", () => {
  const result = validateExport({ markdown: "- https://example.com/", tabs });
  assert.equal(result.ok, true);
  assert.equal(result.coverage, 0.5);
  assert.deepEqual(result.missingUrls, ["https://example.org/page"]);
});
