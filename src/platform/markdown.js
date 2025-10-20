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
 * @property {TemplateWindowContext} window Parent window metadata.
 * @property {TemplateTabTimestamps} timestamps
 *
 * @typedef {Object} TemplateContext
 * @property {string} frontmatter Pre-rendered YAML frontmatter block.
 * @property {TemplateTimestamp} export Export metadata.
 * @property {TemplateWindowContext} window Active browser window metadata.
 * @property {Array<TemplateTabContext>} tabs
 */

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

function formatTimestamp(now = new Date()) {
  const pad = (value) => value.toString().padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  const filename = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
  const iso = now.toISOString();

  const localDate = now
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
    .split("/")
    .reverse()
    .join("-");

  const localTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  return {
    iso,
    filename,
    local: {
      date: localDate,
      time: localTime
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

  const title = typeof windowInfo.title === "string" ? windowInfo.title.trim() : "";
  return {
    id: typeof windowInfo.id === "number" ? windowInfo.id : null,
    title,
    focused: Boolean(windowInfo.focused),
    incognito: Boolean(windowInfo.incognito)
  };
}

function sanitizeYamlValue(value) {
  if (value === "" || value === null || value === undefined) {
    return '""';
  }
  const normalized = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${normalized}"`;
}

function buildFrontmatter(timestamp, tabs, windowInfo) {
  const lines = [
    "---",
    `date_created: ${timestamp.local.date}`,
    `time_created: ${timestamp.local.time}`,
    `exported_at: ${timestamp.iso}`,
    `tab_count: ${tabs.length}`
  ];

  if (windowInfo.title) {
    lines.push(`window_title: ${sanitizeYamlValue(windowInfo.title)}`);
  }

  lines.push(`window_incognito: ${windowInfo.incognito ? "true" : "false"}`);
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

function buildTabContext(tab, index, windowInfo, referenceMs) {
  const title = unescapeTitle(tab?.title ?? "");
  const url = typeof tab?.url === "string" ? tab.url : "";
  const favicon = typeof tab?.favIconUrl === "string" ? tab.favIconUrl : "";
  const urlDetails = parseUrlDetails(url);

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
    window: windowInfo,
    timestamps: toTabTimestamps(tab, referenceMs)
  };
}

/**
 * Creates the template context shared by the renderer and the options preview.
 *
 * @param {Array<import("webextension-polyfill").Tabs.Tab>} tabs
 * @param {{ window?: Partial<TemplateWindowContext>, now?: Date }} [options]
 * @returns {{ context: TemplateContext, timestamp: TemplateTimestamp }}
 */
export function buildTemplateContext(tabs = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const timestamp = formatTimestamp(now);
  const windowInfo = normalizeWindow(options.window);

  const tabContexts = tabs.map((tab, index) => buildTabContext(tab, index, windowInfo, timestamp.epoch));
  const frontmatter = buildFrontmatter(timestamp, tabContexts, windowInfo);

  const context = {
    frontmatter,
    export: {
      iso: timestamp.iso,
      filename: timestamp.filename,
      local: timestamp.local,
      tabCount: tabContexts.length
    },
    window: windowInfo,
    tabs: tabContexts
  };

  return { context, timestamp };
}

/**
 * @param {Array<import("webextension-polyfill").Tabs.Tab>} tabs
 * @param {string} template
 * @param {{ window?: Partial<TemplateWindowContext>, now?: Date }} [options]
 * @returns {{ markdown: string, formattedTimestamp: string }}
 */
export function formatTabsMarkdown(tabs, template = DEFAULT_MARKDOWN_FORMAT, options = {}) {
  const { context, timestamp } = buildTemplateContext(tabs, {
    window: options.window,
    now: options.now
  });

  try {
    const markdown = renderTemplate(template, context);
    return {
      markdown,
      formattedTimestamp: timestamp.filename
    };
  } catch (error) {
    console.error("tabSidian template rendering failed; falling back to default template.", error);
    const fallbackMarkdown = renderTemplate(DEFAULT_MARKDOWN_FORMAT, context);
    return {
      markdown: fallbackMarkdown,
      formattedTimestamp: timestamp.filename
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
    windowId: SAMPLE_WINDOW.id
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
    windowId: SAMPLE_WINDOW.id
  }
];

/**
 * Sample template context that powers the live preview on the options page.
 */
export const SAMPLE_TEMPLATE_CONTEXT = buildTemplateContext(SAMPLE_TABS, {
  window: SAMPLE_WINDOW,
  now: SAMPLE_NOW
}).context;
