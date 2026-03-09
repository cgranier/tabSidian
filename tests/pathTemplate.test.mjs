import test from "node:test";
import assert from "node:assert/strict";
import { applyPathTemplate } from "../src/platform/pathTemplate.js";

test("applyPathTemplate replaces brace and mustache date/time tokens", () => {
  const result = applyPathTemplate(
    "Research/{date}/Tabs-{{time}}.md",
    "2026-03-08T12-30-00",
    "2026-03-08",
    "12-30-00"
  );

  assert.equal(result, "Research/2026-03-08/Tabs-12-30-00.md");
});

test("applyPathTemplate replaces timestamp tokens in both syntaxes", () => {
  const result = applyPathTemplate(
    "tabSidian/{{timestamp}}-{timestamp}.md",
    "2026-03-08T12-30-00",
    "unused",
    "unused"
  );

  assert.equal(result, "tabSidian/2026-03-08T12-30-00-2026-03-08T12-30-00.md");
});

