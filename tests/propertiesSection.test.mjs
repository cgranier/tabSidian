import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTemplateEntries,
  parseTemplateMultiline,
  sanitizeFrontmatterInput,
  toTemplateMultiline,
  validateFrontmatterFieldName
} from "../src/options/sections/properties.js";

test("sanitizeFrontmatterInput trims values", () => {
  assert.equal(sanitizeFrontmatterInput("  created_at  "), "created_at");
});

test("validateFrontmatterFieldName validates empty and invalid names", () => {
  assert.equal(validateFrontmatterFieldName(""), "Field name is required.");
  assert.equal(validateFrontmatterFieldName("bad key"), "Use letters, numbers, hyphen, or underscore.");
  assert.equal(validateFrontmatterFieldName("good_key-1"), "");
});

test("template multiline parse/serialize roundtrip", () => {
  const parsed = parseTemplateMultiline("a\n\nb\n");
  assert.deepEqual(parsed, ["a", "b"]);
  assert.equal(toTemplateMultiline(parsed), "a\nb");
});

test("normalizeTemplateEntries removes duplicates and truncates by max", () => {
  const normalized = normalizeTemplateEntries(["A", "a", "B", "C"], 2);
  assert.equal(normalized.tooMany, true);
  assert.deepEqual(normalized.entries, ["A", "B"]);
  assert.deepEqual(normalized.duplicates, ["a"]);
});

