import test from "node:test";
import assert from "node:assert/strict";
import { formatTabsMarkdown, DEFAULT_MARKDOWN_FORMAT } from "../src/platform/markdown.js";

test("formatTabsMarkdown injects tab data", () => {
  const tabs = [
    { title: "Example", url: "https://example.com" },
    { title: "Docs", url: "https://docs.example.com" }
  ];

  const { markdown } = formatTabsMarkdown(tabs, DEFAULT_MARKDOWN_FORMAT);

  assert.ok(markdown.includes("Example"));
  assert.ok(markdown.includes("https://docs.example.com"));
  assert.ok(markdown.startsWith("---"));
});
