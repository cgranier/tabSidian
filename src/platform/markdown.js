import { renderTemplate } from "./templateEngine.js";

/**
 * @typedef {Object} TemplateTimestamp
 * @property {string} iso ISO 8601 timestamp.
 * @property {string} filename Timestamp used for filenames.
 * @property {{ date: string, time: string }} local Human readable date/time.
 *
 * @typedef {Object} TemplateWindowContext
 * @property {number|null} id
 * @property {string} title
 * @property {boolean} focused
 * @property {boolean} incognito
 *
 * @typedef {Object} TemplateTabTimestamps
 * @property {string} lastAccessed ISO 8601 representation of the last access time.
 * @property {string} lastAccessedRelative Human readable delta against the export time.
 *
 * @typedef {Object} TemplateTabGroup
 * @property {number|null} id
 * @property {string} title
 * @property {string} color
 * @property {string} colorHex
 * @property {boolean} collapsed
 * @property {number|null} windowId
 *
 * @typedef {Object} TemplateTabContext
 * @property {number|null} id
 * @property {number} index Zero-based index in the export order.
 * @property {number} position One-based position in the export order.
 * @property {string} title Cleaned tab title.
 * @property {string} url Tab URL.
 * @property {string} hostname Hostname portion of the URL.
 * @property {string} origin Origin portion of the URL.
 * @property {string} protocol Protocol without the trailing colon.
 * @property {string} pathname Pathname portion of the URL.
 * @property {string} search Query string portion of the URL.
 * @property {string} hash Hash fragment portion of the URL.
 * @property {string} favicon Favicon URL if available.
 * @property {boolean} pinned
 * @property {boolean} active
 * @property {boolean} highlighted
 * @property {boolean} audible
 * @property {boolean} muted
 * @property {boolean} discarded
 * @property {boolean} incognito
 * @property {number|null} windowId
 * @property {number|null} groupId
 * @property {TemplateTabGroup|null} group
 * @property {string} groupTitle
 * @property {string} groupColor
 * @property {string} groupColorHex
 * @property {boolean|null} groupCollapsed
 * @property {TemplateWindowContext} window Parent window metadata.
 * @property {TemplateTabTimestamps} timestamps
 *
 * @typedef {Object} TemplateGroupContext
 * @property {number|null} id
 * @property {string} title
 * @property {string} color
 * @property {string} colorHex
 * @property {boolean} collapsed
 * @property {number|null} windowId
 * @property {number} tabCount
 * @property {Array<TemplateTabContext>} tabs
 *
 * @typedef {Object} TemplateContext
 * @property {string} frontmatter Pre-rendered YAML frontmatter block.
 * @property {TemplateTimestamp} export Export metadata.
 * @property {TemplateWindowContext} window Active browser window metadata.
 * @property {Array<TemplateTabContext>} tabs
 * @property {Array<TemplateGroupContext>} groups
 * @property {Array<TemplateTabContext>} ungroupedTabs
 * @property {Record<string, TemplateTabGroup>} groupMap
 */

export const DEFAULT_FRONTMATTER_FIELDS = Object.freeze({
  title: "title",
  date: "date_created",
  time: "time_created",
  exportedAt: "exported_at",
  tabCount: "tab_count",
  tags: "tags",
  collections: "collections",
  windowIncognito: "window_incognito"
});

export const DEFAULT_FRONTMATTER_ENABLED_FIELDS = Object.freeze({
  title: true,
  date: true,
  time: true,
  exportedAt: true,
  tabCount: true,
  tags: true,
  collections: true,
  windowIncognito: true
});

export const DEFAULT_FRONTMATTER_TITLE_TEMPLATE = Object.freeze(
  "List of {{{export.tabCount}}} tabs saved on {{{export.local.date}}}"
);

export const DEFAULT_FRONTMATTER_TAG_TEMPLATES = Object.freeze(["tabsidian"]);

export const DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES = Object.freeze([]);

export const DEFAULT_EXPORT_DATE_FORMAT = Object.freeze("YYYY-MM-DD");
export const DEFAULT_EXPORT_TIME_FORMAT = Object.freeze("HH:mm:ss");

const TAB_GROUP_COLORS = Object.freeze({});

/** @type {TemplateWindowContext} */
const EMPTY_WINDOW = {
  id: null,
  title: "",
  focused: false,
  incognito: false
};

export const DEFAULT_MARKDOWN_FORMAT = `{{{frontmatter}}}
{{#tabs}}
## {{title}}
[{{url}}]({{url}})

{{/tabs}}`;

function resolveLocale(candidate) {
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }

  if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
    return navigator.language;
  }

  return "en-US";
}

function formatDatePattern(date, pattern, locale) {
  if (typeof pattern !== "string" || pattern.length === 0) {
    return "";
  }

  const pad = (value) => value.toString().padStart(2, "0");
  const localeToUse = resolveLocale(locale);
  const year = date.getFullYear();
  const monthIndex = date.getMonth() + 1;
  const day = date.getDate();
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const monthLong = date.toLocaleString(localeToUse, { month: "long" });
  const monthShort = date.toLocaleString(localeToUse, { month: "short" });
  const weekdayLong = date.toLocaleString(localeToUse, { weekday: "long" });
  const weekdayShort = date.toLocaleString(localeToUse, { weekday: "short" });

  const replacements = Object.freeze({
    YYYY: year.toString(),
    YY: pad(year % 100),
    MMMM: monthLong,
    MMM: monthShort,
    MM: pad(monthIndex),
    M: monthIndex.toString(),
    DD: pad(day),
    D: day.toString(),
    dddd: weekdayLong,
    ddd: weekdayShort,
    HH: pad(hours24),
    H: hours24.toString(),
    hh: pad(hours12),
    h: hours12.toString(),
    mm: pad(minutes),
    m: minutes.toString(),
    ss: pad(seconds),
    s: seconds.toString(),
    A: hours24 >= 12 ? "PM" : "AM",
    a: hours24 >= 12 ? "pm" : "am"
  });

  const tokenRegex =
    /(YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D|HH|H|hh|h|mm|m|ss|s|A|a)/g;
  return pattern.replace(tokenRegex, (token) => replacements[token] ?? token);
}

function formatTimestamp(now = new Date(), formats = {}) {
  const pad = (value) => value.toString().padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  const filename = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
  const iso = now.toISOString();

  const dateFormat =
    typeof formats.dateFormat === "string" && formats.dateFormat.trim().length > 0
      ? formats.dateFormat.trim()
      : DEFAULT_EXPORT_DATE_FORMAT;
  const timeFormat =
    typeof formats.timeFormat === "string" && formats.timeFormat.trim().length > 0
      ? formats.timeFormat.trim()
      : DEFAULT_EXPORT_TIME_FORMAT;
  const locale = formats.locale;

  const localDate = formatDatePattern(now, dateFormat, locale) || formatDatePattern(now, DEFAULT_EXPORT_DATE_FORMAT, locale);
  const localTime = formatDatePattern(now, timeFormat, locale) || formatDatePattern(now, DEFAULT_EXPORT_TIME_FORMAT, locale);

  return {
    iso,
    filename,
    local: {
      date: localDate,
      time: localTime,
      formats: {
        date: dateFormat,
        time: timeFormat
      }
    },
    epoch: now.getTime()
  };
}

function describeRelativeDuration(referenceMs, targetMs) {
  const deltaSeconds = Math.round((referenceMs - targetMs) / 1000);
  if (!Number.isFinite(deltaSeconds)) {
    return "";
  }

  if (Math.abs(deltaSeconds) < 60) {
    return "just now";
  }

  const minutes = Math.round(deltaSeconds / 60);
  const absMinutes = Math.abs(minutes);
  if (absMinutes < 60) {
    return `${absMinutes} minute${absMinutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.round(minutes / 60);
  const absHours = Math.abs(hours);
  if (absHours < 24) {
    return `${absHours} hour${absHours === 1 ? "" : "s"} ago`;
  }

  const days = Math.round(hours / 24);
  const absDays = Math.abs(days);
  return `${absDays} day${absDays === 1 ? "" : "s"} ago`;
}

function unescapeTitle(rawTitle) {
  if (typeof rawTitle !== "string" || rawTitle.length === 0) {
    return "";
  }

  const requiresDecoding = rawTitle.includes("+") || /%[0-9A-Fa-f]{2}/.test(rawTitle);
  const candidate = requiresDecoding ? rawTitle.replace(/\+/g, " ") : rawTitle;

  let decoded = candidate;
  if (requiresDecoding) {
    try {
      decoded = decodeURIComponent(candidate);
    } catch (_error) {
      decoded = candidate;
    }
  }

  const trimmed = decoded.replace(/^\s+/, "");
  const withoutHashes = trimmed.replace(/^#+\s*/, "");
  return withoutHashes.length > 0 ? withoutHashes : trimmed;
}

function escapeMarkdownMathDelimiters(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }
  return value.replace(/\$/g, "\\$");
}

function parseUrlDetails(rawUrl = "") {
  try {
    const parsed = new URL(rawUrl);
    return {
      hostname: parsed.hostname ?? "",
      origin: parsed.origin ?? "",
      protocol: parsed.protocol ? parsed.protocol.replace(":", "") : "",
      pathname: parsed.pathname ?? "",
      search: parsed.search ?? "",
      hash: parsed.hash ?? ""
    };
  } catch (_error) {
    return {
      hostname: "",
      origin: "",
      protocol: "",
      pathname: "",
      search: "",
      hash: ""
    };
  }
}

function normalizeWindow(windowInfo) {
  if (!windowInfo) {
    return { ...EMPTY_WINDOW };
  }

  const title = typeof windowInfo.title === "string" ? escapeMarkdownMathDelimiters(windowInfo.title.trim()) : "";
  return {
    id: typeof windowInfo.id === "number" ? windowInfo.id : null,
    title,
    focused: Boolean(windowInfo.focused),
    incognito: Boolean(windowInfo.incognito)
  };
}

function normalizeTabGroup(rawGroup, fallbackId) {
  if (!rawGroup || typeof rawGroup !== "object") {
    return null;
  }

  const id = typeof rawGroup.id === "number" ? rawGroup.id : typeof fallbackId === "number" ? fallbackId : null;
  const color = typeof rawGroup.color === "string" ? rawGroup.color : "";
  const title = typeof rawGroup.title === "string" ? escapeMarkdownMathDelimiters(rawGroup.title) : "";
  let colorHex = "";
  if (typeof rawGroup.colorCode === "string" && rawGroup.colorCode.length > 0) {
    colorHex = rawGroup.colorCode;
  } else if (TAB_GROUP_COLORS[color]) {
    colorHex = TAB_GROUP_COLORS[color];
  }

  return {
    id,
    title,
    color,
    colorHex,
    collapsed: Boolean(rawGroup.collapsed),
    windowId: typeof rawGroup.windowId === "number" ? rawGroup.windowId : null
  };
}

function normalizeTabGroups(rawGroups = {}) {
  if (!rawGroups || typeof rawGroups !== "object") {
    return {};
  }

  const normalized = {};
  Object.entries(rawGroups).forEach(([key, value]) => {
    const numericKey = Number(key);
    const group = normalizeTabGroup(value, Number.isFinite(numericKey) ? numericKey : undefined);
    if (group && typeof group.id === "number") {
      normalized[group.id] = group;
    }
  });

  return normalized;
}

function sanitizeYamlValue(value) {
  if (value === "" || value === null || value === undefined) {
    return '""';
  }
  const normalized = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${normalized}"`;
}

const FIELD_NAME_PATTERN = /^[A-Za-z0-9_\-]+$/;

function sanitizeFieldName(candidate, fallback) {
  if (typeof candidate !== "string") {
    return fallback;
  }
  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return fallback;
  }
  if (!FIELD_NAME_PATTERN.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export function resolveFrontmatterFields(overrides = {}) {
  const normalized = { ...DEFAULT_FRONTMATTER_FIELDS };

  /** @type {Array<keyof typeof DEFAULT_FRONTMATTER_FIELDS>} */
  const keys = /** @type {Array<keyof typeof DEFAULT_FRONTMATTER_FIELDS>} */ (Object.keys(DEFAULT_FRONTMATTER_FIELDS));
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      normalized[key] = sanitizeFieldName(overrides[key], DEFAULT_FRONTMATTER_FIELDS[key]);
    }
  });

  return normalized;
}

export function resolveFrontmatterEnabled(overrides = {}) {
  const normalized = { ...DEFAULT_FRONTMATTER_ENABLED_FIELDS };
  Object.keys(DEFAULT_FRONTMATTER_ENABLED_FIELDS).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      normalized[key] = Boolean(overrides[key]);
    }
  });
  return normalized;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#36;/g, "$");
}

function createFrontmatterContext(timestamp, tabs, windowInfo) {
  const tabCount = Array.isArray(tabs) ? tabs.length : 0;
  return {
    export: {
      iso: timestamp.iso,
      filename: timestamp.filename,
      local: timestamp.local,
      tabCount
    },
    window: {
      title: windowInfo.title,
      incognito: Boolean(windowInfo.incognito),
      focused: Boolean(windowInfo.focused),
      id: windowInfo.id ?? null
    },
    tabCount
  };
}

function renderFrontmatterTemplate(template, context, fallback = "") {
  if (typeof template !== "string") {
    return fallback;
  }

  const trimmed = template.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  try {
    const rendered = renderTemplate(trimmed, context);
    const decoded = decodeHtmlEntities(rendered).trim();
    return decoded.length > 0 ? decoded : fallback;
  } catch (error) {
    console.error("Unable to render frontmatter template", error);
    return fallback;
  }
}

function renderFrontmatterList(templates, context, fallbackTemplates) {
  const candidate = Array.isArray(templates) ? templates : fallbackTemplates;
  const source = Array.isArray(candidate) && candidate.length > 0 ? candidate : fallbackTemplates;
  if (!Array.isArray(source)) {
    return [];
  }

  const rendered = [];
  const seen = new Set();

  source.forEach((entry) => {
    const value = renderFrontmatterTemplate(entry, context, "").trim();
    if (value.length === 0) {
      return;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rendered.push(value);
  });

  return rendered;
}

function buildFrontmatter(timestamp, tabs, windowInfo, options = {}) {
  const {
    fieldNames,
    titleTemplate = DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
    tagTemplates,
    collectionTemplates,
    enabledFields
  } = options;

  const names = resolveFrontmatterFields(fieldNames);
  const enabled = resolveFrontmatterEnabled(enabledFields);
  const activeKeys = Object.keys(enabled).filter((key) => enabled[key]);
  if (activeKeys.length === 0) {
    return "";
  }
  const context = createFrontmatterContext(timestamp, tabs, windowInfo);
  const fallbackTitle = renderFrontmatterTemplate(DEFAULT_FRONTMATTER_TITLE_TEMPLATE, context, "");
  const title = renderFrontmatterTemplate(titleTemplate, context, fallbackTitle || "Tab capture");
  const tags = renderFrontmatterList(tagTemplates, context, DEFAULT_FRONTMATTER_TAG_TEMPLATES);
  const collections = renderFrontmatterList(
    collectionTemplates,
    context,
    DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES
  );

  const lines = ["---"];

  if (enabled.title) {
    lines.push(`${names.title}: ${sanitizeYamlValue(title)}`);
  }
  if (enabled.date) {
    lines.push(`${names.date}: ${timestamp.local.date}`);
  }
  if (enabled.time) {
    lines.push(`${names.time}: ${timestamp.local.time}`);
  }
  if (enabled.exportedAt) {
    lines.push(`${names.exportedAt}: ${timestamp.iso}`);
  }
  if (enabled.tabCount) {
    lines.push(`${names.tabCount}: ${tabs.length}`);
  }
  if (enabled.windowIncognito) {
    lines.push(`${names.windowIncognito}: ${windowInfo.incognito ? "true" : "false"}`);
  }
  if (enabled.tags) {
    if (tags.length === 0) {
      lines.push(`${names.tags}: []`);
    } else {
      lines.push(`${names.tags}:`);
      tags.forEach((tag) => {
        lines.push(`  - ${sanitizeYamlValue(tag)}`);
      });
    }
  }
  if (enabled.collections) {
    if (collections.length === 0) {
      lines.push(`${names.collections}: []`);
    } else {
      lines.push(`${names.collections}:`);
      collections.forEach((entry) => {
        lines.push(`  - ${sanitizeYamlValue(entry)}`);
      });
    }
  }

  if (lines.length === 1) {
    return "";
  }

  lines.push("---", "");
  return lines.join("\n");
}

function toTabTimestamps(tab, referenceMs) {
  const lastAccessedMs = typeof tab.lastAccessed === "number" ? tab.lastAccessed : Number.NaN;
  if (!Number.isFinite(lastAccessedMs) || lastAccessedMs <= 0) {
    return {
      lastAccessed: "",
      lastAccessedRelative: ""
    };
  }

  const iso = new Date(lastAccessedMs).toISOString();
  return {
    lastAccessed: iso,
    lastAccessedRelative: describeRelativeDuration(referenceMs, lastAccessedMs)
  };
}

function buildTabContext(tab, index, windowInfo, referenceMs, groupDetails) {
  const title = escapeMarkdownMathDelimiters(unescapeTitle(tab?.title ?? ""));
  const url = typeof tab?.url === "string" ? tab.url : "";
  const favicon = typeof tab?.favIconUrl === "string" ? tab.favIconUrl : "";
  const urlDetails = parseUrlDetails(url);
  const rawGroupId = typeof tab?.groupId === "number" ? tab.groupId : -1;
  const group = rawGroupId >= 0 ? groupDetails?.[rawGroupId] ?? null : null;

  return {
    id: typeof tab?.id === "number" ? tab.id : null,
    index,
    position: index + 1,
    title,
    url,
    hostname: urlDetails.hostname,
    origin: urlDetails.origin,
    protocol: urlDetails.protocol,
    pathname: urlDetails.pathname,
    search: urlDetails.search,
    hash: urlDetails.hash,
    favicon,
    pinned: Boolean(tab?.pinned),
    active: Boolean(tab?.active),
    highlighted: Boolean(tab?.highlighted),
    audible: Boolean(tab?.audible),
    muted: tab?.mutedInfo ? Boolean(tab.mutedInfo.muted) : Boolean(tab?.muted),
    discarded: Boolean(tab?.discarded),
    incognito: Boolean(tab?.incognito),
    windowId: typeof tab?.windowId === "number" ? tab.windowId : null,
    groupId: group?.id ?? (rawGroupId >= 0 ? rawGroupId : null),
    groupTitle: group?.title ?? "",
    groupColor: group?.color ?? "",
    groupColorHex: group?.colorHex ?? "",
    groupCollapsed: typeof group?.collapsed === "boolean" ? group.collapsed : null,
    group,
    window: windowInfo,
    timestamps: toTabTimestamps(tab, referenceMs)
  };
}

/**
 * Creates the template context shared by the renderer and the options preview.
 *
 * @param {Array<import("webextension-polyfill").Tabs.Tab>} tabs
 * @param {{ window?: Partial<TemplateWindowContext>, now?: Date, frontmatterFields?: Record<string, string>, frontmatterEnabled?: Record<string, boolean>, tabGroups?: Record<number, unknown>, frontmatterTitleTemplate?: string, frontmatterTagTemplates?: Array<string>, frontmatterCollectionTemplates?: Array<string>, timestampFormats?: { dateFormat?: string, timeFormat?: string, locale?: string } }} [options]
 * @returns {{ context: TemplateContext, timestamp: TemplateTimestamp }}
 */
export function buildTemplateContext(tabs = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const timestamp = formatTimestamp(now, options.timestampFormats);
  const windowInfo = normalizeWindow(options.window);
  const frontmatterFields = resolveFrontmatterFields(options.frontmatterFields);
  const frontmatterEnabled = resolveFrontmatterEnabled(options.frontmatterEnabled);
  const groupDetails = normalizeTabGroups(options.tabGroups);

  const tabContexts = tabs.map((tab, index) => buildTabContext(tab, index, windowInfo, timestamp.epoch, groupDetails));
  const frontmatter = buildFrontmatter(timestamp, tabContexts, windowInfo, {
    fieldNames: frontmatterFields,
    titleTemplate: options.frontmatterTitleTemplate,
    tagTemplates: options.frontmatterTagTemplates,
    collectionTemplates: options.frontmatterCollectionTemplates,
    enabledFields: frontmatterEnabled
  });

  const groupedTabs = new Map();
  tabContexts.forEach((tab) => {
    if (tab.group && typeof tab.group.id === "number") {
      if (!groupedTabs.has(tab.group.id)) {
        groupedTabs.set(tab.group.id, []);
      }
      groupedTabs.get(tab.group.id).push(tab);
    }
  });

  const groups = Array.from(groupedTabs.entries()).map(([id, grouped]) => {
    const detail = groupDetails[id] ?? normalizeTabGroup({ id }, id) ?? { id, title: "", color: "", colorHex: "", collapsed: false, windowId: null };
    return {
      id: detail.id,
      title: detail.title,
      color: detail.color,
      colorHex: detail.colorHex,
      collapsed: Boolean(detail.collapsed),
      windowId: detail.windowId,
      tabCount: grouped.length,
      tabs: grouped
    };
  });

  const ungroupedTabs = tabContexts.filter((tab) => !tab.group);

  const context = {
    frontmatter,
    export: {
      iso: timestamp.iso,
      filename: timestamp.filename,
      local: timestamp.local,
      tabCount: tabContexts.length
    },
    window: windowInfo,
    tabs: tabContexts,
    groups,
    ungroupedTabs,
    groupMap: groupDetails,
    frontmatterFields,
    frontmatterEnabled
  };

  return { context, timestamp };
}

/**
 * @param {Array<import("webextension-polyfill").Tabs.Tab>} tabs
 * @param {string} template
 * @param {{ window?: Partial<TemplateWindowContext>, now?: Date, frontmatterFields?: Record<string, string>, frontmatterEnabled?: Record<string, boolean>, tabGroups?: Record<number, unknown>, frontmatterTitleTemplate?: string, frontmatterTagTemplates?: Array<string>, frontmatterCollectionTemplates?: Array<string>, timestampFormats?: { dateFormat?: string, timeFormat?: string, locale?: string } }} [options]
 * @returns {{ markdown: string, formattedTimestamp: string }}
 */
export function formatTabsMarkdown(tabs, template = DEFAULT_MARKDOWN_FORMAT, options = {}) {
  const { context, timestamp } = buildTemplateContext(tabs, {
    window: options.window,
    now: options.now,
    frontmatterFields: options.frontmatterFields,
    frontmatterEnabled: options.frontmatterEnabled,
    tabGroups: options.tabGroups,
    frontmatterTitleTemplate: options.frontmatterTitleTemplate,
    frontmatterTagTemplates: options.frontmatterTagTemplates,
    frontmatterCollectionTemplates: options.frontmatterCollectionTemplates,
    timestampFormats: options.timestampFormats
  });

  try {
    const markdown = renderTemplate(template, context);
    return {
      markdown,
      formattedTimestamp: timestamp.filename,
      timestamp
    };
  } catch (error) {
    console.error("tabSidian template rendering failed; falling back to default template.", error);
    const fallbackMarkdown = renderTemplate(DEFAULT_MARKDOWN_FORMAT, context);
    return {
      markdown: fallbackMarkdown,
      formattedTimestamp: timestamp.filename,
      timestamp
    };
  }
}

const SAMPLE_WINDOW = {
  id: 42,
  title: "Research – tabSidian",
  focused: true,
  incognito: false
};

const SAMPLE_NOW = new Date("2024-03-15T12:34:56Z");
const SAMPLE_NOW_MS = SAMPLE_NOW.getTime();

const SAMPLE_TABS = [
  {
    id: 1,
    title: "tabSidian · GitHub",
    url: "https://github.com/cgranier/tabSidian",
    favIconUrl: "https://github.githubassets.com/favicons/favicon.svg",
    active: true,
    highlighted: true,
    pinned: false,
    audible: false,
    muted: false,
    discarded: false,
    incognito: false,
    lastAccessed: SAMPLE_NOW_MS - 5 * 60 * 1000,
    windowId: SAMPLE_WINDOW.id,
    groupId: 1
  },
  {
    id: 2,
    title: "Obsidian Forums",
    url: "https://forum.obsidian.md/",
    favIconUrl: "https://forum.obsidian.md/uploads/default/original/1X/obsidian-icon.png",
    active: false,
    highlighted: true,
    pinned: false,
    audible: false,
    muted: false,
    discarded: false,
    incognito: false,
    lastAccessed: SAMPLE_NOW_MS - 2 * 60 * 60 * 1000,
    windowId: SAMPLE_WINDOW.id,
    groupId: 1
  },
  {
    id: 3,
    title: "Inspiration Board",
    url: "https://www.figma.com/file/abc123/project-mockups",
    favIconUrl: "https://static.figma.com/app/icon/1/icon-192.png",
    active: false,
    highlighted: false,
    pinned: false,
    audible: false,
    muted: false,
    discarded: false,
    incognito: false,
    lastAccessed: SAMPLE_NOW_MS - 30 * 60 * 1000,
    windowId: SAMPLE_WINDOW.id,
    groupId: 2
  },
  {
    id: 4,
    title: "API Reference",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Clipboard",
    favIconUrl: "https://developer.mozilla.org/static/img/favicon144.png",
    active: false,
    highlighted: false,
    pinned: false,
    audible: false,
    muted: false,
    discarded: false,
    incognito: false,
    lastAccessed: SAMPLE_NOW_MS - 10 * 60 * 1000,
    windowId: SAMPLE_WINDOW.id
  }
];

const SAMPLE_GROUPS = {
  1: {
    id: 1,
    title: "Research",
    color: "blue",
    collapsed: false,
    windowId: SAMPLE_WINDOW.id
  },
  2: {
    id: 2,
    title: "Design",
    color: "green",
    collapsed: false,
    windowId: SAMPLE_WINDOW.id
  }
};

export function createSampleTemplateContext(
  frontmatterFields,
  tabGroups = SAMPLE_GROUPS,
  extras = {}
) {
  return buildTemplateContext(SAMPLE_TABS, {
    window: SAMPLE_WINDOW,
    now: SAMPLE_NOW,
    frontmatterFields,
    tabGroups,
    frontmatterEnabled: extras.frontmatterEnabled,
    frontmatterTitleTemplate: extras.frontmatterTitleTemplate,
    frontmatterTagTemplates: extras.frontmatterTagTemplates,
    frontmatterCollectionTemplates: extras.frontmatterCollectionTemplates,
    timestampFormats: extras.timestampFormats
  }).context;
}

/**
 * Sample template context that powers the live preview on the options page.
 */
export const SAMPLE_TEMPLATE_CONTEXT = createSampleTemplateContext(undefined, SAMPLE_GROUPS);
