import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTabsMarkdown,
  DEFAULT_MARKDOWN_FORMAT,
  buildTemplateContext,
  resolveFrontmatterFields
} from "../src/platform/markdown.js";
import {
  DEFAULT_FRONTMATTER_FIELDS,
  DEFAULT_FRONTMATTER_TITLE_TEMPLATE
} from "../src/platform/defaults.js";

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
    windowId: 99,
    groupId: 1
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

const SAMPLE_GROUPS = {
  1: {
    id: 1,
    title: "Reading",
    color: "blue",
    collapsed: false,
    windowId: SAMPLE_WINDOW.id
  }
};

const FIXED_NOW = new Date("2025-10-20T19:58:28.460Z");

test("formatTabsMarkdown renders the default template with frontmatter and headings", () => {
  const { markdown } = formatTabsMarkdown(SAMPLE_TABS, DEFAULT_MARKDOWN_FORMAT, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW,
    tabGroups: SAMPLE_GROUPS
  });

  const expectedTitle = DEFAULT_FRONTMATTER_TITLE_TEMPLATE.replace("{{{export.tabCount}}}", "2").replace(
    "{{{export.local.date}}}",
    "2025-10-20"
  );

  assert.match(markdown, /^---\n/);
  assert.ok(markdown.includes(`title: "${expectedTitle}"`));
  assert.ok(markdown.includes("tags:\n  - \"tabsidian\""));
  assert.ok(markdown.includes("collections: []"));
  assert.ok(markdown.includes("## Example &lt;Tab&gt;"));
  assert.ok(markdown.includes("[https://docs.example.com/]"));
});

test("buildTemplateContext exposes tab metadata and timestamps", () => {
  const now = new Date("2024-01-02T03:04:05Z");
  const { context } = buildTemplateContext(SAMPLE_TABS, {
    window: SAMPLE_WINDOW,
    now,
    tabGroups: SAMPLE_GROUPS
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
  assert.deepEqual(context.frontmatterFields, DEFAULT_FRONTMATTER_FIELDS);
});

test("buildTemplateContext includes tab group information", () => {
  const { context } = buildTemplateContext(SAMPLE_TABS, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW,
    tabGroups: SAMPLE_GROUPS
  });

  assert.equal(context.groups.length, 1);
  const group = context.groups[0];
  assert.equal(group.title, "Reading");
  assert.equal(group.color, "blue");
  assert.equal(group.tabCount, 1);
  assert.equal(group.tabs[0].title, "Example <Tab>");
  assert.equal(context.tabs[0].groupTitle, "Reading");
  assert.equal(context.tabs[1].group, null);
  assert.equal(context.groupMap[1].color, "blue");
});

test("formatTabsMarkdown falls back to the default template when rendering fails", () => {
  const invalidTemplate = "{{#tabs}}\n- {{title}}\n";
  const fallback = formatTabsMarkdown(SAMPLE_TABS, invalidTemplate, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW,
    tabGroups: SAMPLE_GROUPS
  });
  const expected = formatTabsMarkdown(SAMPLE_TABS, DEFAULT_MARKDOWN_FORMAT, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW,
    tabGroups: SAMPLE_GROUPS
  });

  assert.equal(fallback.markdown, expected.markdown);
  assert.equal(fallback.formattedTimestamp, expected.formattedTimestamp);
});

test("formatTabsMarkdown respects custom frontmatter field names", () => {
  const customFields = {
    title: "note_title",
    date: "date",
    time: "time",
    exportedAt: "exported_at",
    tabCount: "total_tabs",
    tags: "labels",
    collections: "folders",
    windowIncognito: "private"
  };

  const tagTemplates = ["tabsidian", "{{{window.title}}}"];
  const collectionTemplates = ["Research/{{{export.local.date}}}"];

  const { markdown } = formatTabsMarkdown(SAMPLE_TABS, DEFAULT_MARKDOWN_FORMAT, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW,
    frontmatterFields: customFields,
    frontmatterTagTemplates: tagTemplates,
    frontmatterCollectionTemplates: collectionTemplates,
    tabGroups: SAMPLE_GROUPS
  });

  assert.ok(markdown.includes('note_title: "List of 2 tabs saved on 2025-10-20"'));
  assert.ok(markdown.includes("date: 2025-10-20"));
  assert.ok(markdown.includes("total_tabs: 2"));
  assert.ok(markdown.includes("labels:\n  - \"tabsidian\"\n  - \"Workspace · Project\""));
  assert.ok(markdown.includes("folders:\n  - \"Research/2025-10-20\""));
  assert.ok(!markdown.includes("tab_count:"));
});

test("buildTemplateContext omits frontmatter when all fields are disabled", () => {
  const disabled = {
    title: false,
    date: false,
    time: false,
    exportedAt: false,
    tabCount: false,
    tags: false,
    collections: false,
    windowIncognito: false
  };
  const { context } = buildTemplateContext(SAMPLE_TABS, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW,
    frontmatterEnabled: disabled
  });

  assert.equal(context.frontmatter, "");

  const { markdown } = formatTabsMarkdown(SAMPLE_TABS, DEFAULT_MARKDOWN_FORMAT, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW,
    frontmatterEnabled: disabled
  });

  assert.ok(!markdown.startsWith("---"));
});

test("formatTabsMarkdown only includes enabled frontmatter fields", () => {
  const enabled = {
    title: false,
    date: true,
    time: false,
    exportedAt: false,
    tabCount: true,
    tags: false,
    collections: false,
    windowIncognito: true
  };

  const { markdown } = formatTabsMarkdown(SAMPLE_TABS, DEFAULT_MARKDOWN_FORMAT, {
    window: SAMPLE_WINDOW,
    now: FIXED_NOW,
    frontmatterEnabled: enabled
  });

  assert.ok(markdown.includes("date_created: 2025-10-20"));
  assert.ok(markdown.includes("tab_count: 2"));
  assert.ok(markdown.includes("window_incognito: false"));
  assert.ok(!markdown.includes("title: "));
  assert.ok(!markdown.includes("tags:"));
  assert.ok(!markdown.includes("collections:"));
  assert.ok(!markdown.includes("time_created:"));
  assert.ok(!markdown.includes("exported_at:"));
});

test("resolveFrontmatterFields falls back to defaults for invalid entries", () => {
  const overrides = {
    title: "Title!",
    date: "Date!",
    time: "export_time",
    exportedAt: "when",
    tabCount: "",
    tags: "tag-list",
    collections: "folders",
    windowIncognito: "private-mode"
  };

  const resolved = resolveFrontmatterFields(overrides);

  assert.equal(resolved.title, DEFAULT_FRONTMATTER_FIELDS.title);
  assert.equal(resolved.date, DEFAULT_FRONTMATTER_FIELDS.date);
  assert.equal(resolved.time, "export_time");
  assert.equal(resolved.exportedAt, "when");
  assert.equal(resolved.tabCount, DEFAULT_FRONTMATTER_FIELDS.tabCount);
  assert.equal(resolved.tags, "tag-list");
  assert.equal(resolved.collections, "folders");
  assert.equal(resolved.windowIncognito, "private-mode");
});
