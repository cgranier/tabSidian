import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTabsMarkdown,
  DEFAULT_MARKDOWN_FORMAT,
  buildTemplateContext
} from "../src/platform/markdown.js";

const SAMPLE_TABS = [
  {
    id: 10,
    title: "Example <Tab>",
    url: "https://example.com/path?query=1",
    favIconUrl: "https://example.com/favicon.ico",
    active: true,
    highlighted: true,
    pinned: false,
    audible: false,
    muted: false,
    discarded: false,
    incognito: false,
    lastAccessed: Date.parse("2024-01-01T12:00:00Z"),
    windowId: 99
  },
  {
    id: 11,
    title: "Docs",
    url: "https://docs.example.com/",
    favIconUrl: "",
    active: false,
    highlighted: true,
    pinned: false,
    audible: false,
    muted: false,
    discarded: false,
    incognito: false,
    lastAccessed: Date.parse("2023-12-31T23:30:00Z"),
    windowId: 99
  }
];

const SAMPLE_WINDOW = {
  id: 99,
  title: "Workspace · Project",
  incognito: false,
  focused: true
};

const FIXED_NOW = new Date("2025-10-20T19:58:28.460Z");

test("formatTabsMarkdown renders the default template with frontmatter and headings", () => {
  const { markdown } = formatTabsMarkdown(SAMPLE_TABS, DEFAULT_MARKDOWN_FORMAT, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW
  });

  assert.match(markdown, /^---\n/);
  assert.ok(markdown.includes('window_title: "Workspace · Project"'));
  assert.ok(markdown.includes("## Example &lt;Tab&gt;"));
  assert.ok(markdown.includes("[https://docs.example.com/]"));
});

test("buildTemplateContext exposes tab metadata and timestamps", () => {
  const now = new Date("2024-01-02T03:04:05Z");
  const { context } = buildTemplateContext(SAMPLE_TABS, {
    window: SAMPLE_WINDOW,
    now
  });

  assert.equal(context.tabs.length, 2);
  const firstTab = context.tabs[0];
  assert.equal(firstTab.title, "Example <Tab>");
  assert.equal(firstTab.hostname, "example.com");
  assert.equal(firstTab.favicon, "https://example.com/favicon.ico");
  assert.equal(firstTab.timestamps.lastAccessed, "2024-01-01T12:00:00.000Z");
  assert.equal(firstTab.window.title, SAMPLE_WINDOW.title);
  assert.equal(context.export.tabCount, 2);
  assert.equal(context.window.title, SAMPLE_WINDOW.title);
  assert.equal(context.tabs[1].timestamps.lastAccessedRelative, "1 day ago");
});

test("formatTabsMarkdown falls back to the default template when rendering fails", () => {
  const invalidTemplate = "{{#tabs}}\n- {{title}}\n";
  const fallback = formatTabsMarkdown(SAMPLE_TABS, invalidTemplate, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW
  });
  const expected = formatTabsMarkdown(SAMPLE_TABS, DEFAULT_MARKDOWN_FORMAT, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW
  });

  assert.equal(fallback.markdown, expected.markdown);
  assert.equal(fallback.formattedTimestamp, expected.formattedTimestamp);
});
