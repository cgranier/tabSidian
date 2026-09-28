import browser from "../platform/browser.js";
import {
  DEFAULT_MARKDOWN_FORMAT,
  DEFAULT_RESTRICTED_URLS,
  BUILT_IN_PRESETS,
  DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
  DEFAULT_FRONTMATTER_TAG_TEMPLATES,
  DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES,
  DEFAULT_FRONTMATTER_ENABLED_FIELDS,
  DEFAULT_EXPORT_DATE_FORMAT,
  DEFAULT_EXPORT_TIME_FORMAT
} from "../platform/defaults.js";
import { deliverMarkdownFile } from "../platform/download.js";
import {
  formatTabsMarkdown,
  resolveFrontmatterFields,
  resolveFrontmatterEnabled
} from "../platform/markdown.js";
import { sanitizeRestrictedUrls, shouldProcessTab, isRestrictedUrl, selectSavableTabs } from "../platform/tabFilters.js";
import { IS_FIREFOX } from "../platform/runtime.js";
import { OBSIDIAN_NEW_SCHEME, planObsidianExport, resolveMaxObsidianUriLength } from "../platform/obsidian.js";
import { getActiveTab, launchObsidianUri, openObsidianInNewTab } from "../platform/obsidianLaunch.js";
import { sendExportToObsidian, writeClipboardText } from "../platform/obsidianExport.js";
import { validateExport } from "../platform/exportValidator.js";
import { emitMetric } from "../platform/metrics.js";
import { applyPathTemplate } from "../platform/pathTemplate.js";
import { setupMigration } from "./migration.js";
import {
  getStoredValues,
  getSaveTargetDefaults,
  getTemplates,
  getVaults,
  resolveSaveTarget,
  ensureStorageMigration
} from "../platform/storage.js";

setupMigration();
const NOTIFICATION_ICON = "icon128.png";
const MAX_OBSIDIAN_URI_LENGTH = resolveMaxObsidianUriLength({ isFirefox: IS_FIREFOX });

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const VALID_SEGMENT_SEPARATOR = "/";

function detectPlatform() {
  const uaData = (typeof navigator !== "undefined" && navigator.userAgentData) || null;
  const platform =
    (uaData && Array.isArray(uaData.platforms) && uaData.platforms[0]) ||
    (uaData && uaData.platform) ||
    (typeof navigator !== "undefined" ? navigator.platform : "") ||
    "";
  const lower = platform.toLowerCase();
  return {
    isWindows: lower.includes("win"),
    isMac: lower.includes("mac")
  };
}

function sanitizeFileNameSegment(segment, { isWindows, isMac }) {
  const base = typeof segment === "string" ? segment : "";
  let sanitized = base.replace(/[#|\^\[\]]/g, "");

  if (isWindows) {
    sanitized = sanitized
      .replace(/[<>:"/\\?*\x00-\x1F]/g, "")
      .replace(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i, "_$1$2")
      .replace(/[\s.]+$/g, "");
  } else if (isMac) {
    sanitized = sanitized
      .replace(/[/:\x00-\x1F]/g, "")
      .replace(/^\./, "_");
  } else {
    sanitized = sanitized
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/^\./, "_");
  }

  sanitized = sanitized
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 245);

  if (sanitized.length === 0) {
    sanitized = "Untitled";
  }

  return sanitized;
}

function sanitizeNotePath(value) {
  const normalized = sanitizeText(value)
    .replace(/\\/g, VALID_SEGMENT_SEPARATOR)
    .split(VALID_SEGMENT_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (normalized.length === 0) {
    return "";
  }

  const platformInfo = detectPlatform();

  const sanitizedSegments = normalized.map((segment) => {
    const sanitized = sanitizeFileNameSegment(segment, platformInfo);
    if (platformInfo.isWindows) {
      const base = sanitized.replace(/\.[^.]+$/, "");
      if (WINDOWS_RESERVED.test(base)) {
        const ext = sanitized.slice(base.length);
        return `_${base}${ext}`;
      }
    }
    return sanitized;
  });

  const sanitizedPath = sanitizedSegments.join(VALID_SEGMENT_SEPARATOR);
  const withExtension = sanitizedPath.toLowerCase().endsWith(".md") ? sanitizedPath : `${sanitizedPath}.md`;

  if (/(^|\/)(\.{1,2})(\/|$)/.test(withExtension)) {
    return "";
  }

  return withExtension;
}

function applyNotePathTemplate(notePath, formattedTimestamp, timestamp) {
  let resolved;
  if (timestamp && timestamp.local) {
    const dateSegment = sanitizeFileNameSegment(timestamp.local.date, detectPlatform());
    const timeSegment = sanitizeFileNameSegment(timestamp.local.time, detectPlatform());
    resolved = applyPathTemplate(notePath, formattedTimestamp, dateSegment, timeSegment);
  } else {
    resolved = applyPathTemplate(notePath, formattedTimestamp, formattedTimestamp, formattedTimestamp);
  }
  return resolved;
}

function sanitizeFormatSetting(value, fallback) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return fallback;
}

async function notifyUser(title, message) {
  const notifications = browser?.notifications;
  if (!notifications?.create) {
    return;
  }

  try {
    await notifications.create(`tabsidian-${Date.now()}`, {
      type: "basic",
      title,
      message,
      iconUrl: browser.runtime.getURL(NOTIFICATION_ICON)
    });
  } catch (error) {
    console.warn("tabSidian failed to display notification", error);
  }
}

async function resolveTabGroups(tabs = []) {
  const groups = {};
  if (!browser?.tabGroups?.get) {
    return groups;
  }

  const ids = [...new Set(tabs.map((tab) => (typeof tab.groupId === "number" ? tab.groupId : -1)).filter((id) => id >= 0))];
  await Promise.all(
    ids.map(async (groupId) => {
      try {
        const group = await browser.tabGroups.get(groupId);
        if (group) {
          groups[groupId] = group;
        }
      } catch (error) {
        console.warn("tabSidian failed to resolve tab group", groupId, error);
      }
    })
  );

  return groups;
}

async function resolveUserPreferences(overrides = {}) {
  await ensureStorageMigration();
  const storage = await getStoredValues([
    "restrictedUrls",
    "markdownFormat",
    "frontmatterFieldNames",
    "frontmatterTitleTemplate",
    "frontmatterTagTemplates",
    "frontmatterCollectionTemplates",
    "frontmatterEnabledFields",
    "exportDateFormat",
    "exportTimeFormat"
  ]);

  // Handle Overrides
  let format = typeof storage.markdownFormat === "string" && storage.markdownFormat.trim().length > 0
    ? storage.markdownFormat
    : DEFAULT_MARKDOWN_FORMAT;

  const saveTargetDefaults = await getSaveTargetDefaults();
  let obsidianVault = "";
  let obsidianNotePathSource = saveTargetDefaults.folder
    ? `${saveTargetDefaults.folder}/${saveTargetDefaults.filenamePattern}`
    : saveTargetDefaults.filenamePattern;

  const vaults = await getVaults();
  const globalDefaultVault = vaults.find((vault) => vault.isDefault) ?? vaults[0];
  obsidianVault = sanitizeText(globalDefaultVault?.name);

  if (overrides.templateId) {
    const templates = await getTemplates();
    const template = [...BUILT_IN_PRESETS, ...templates].find((t) => t.id === overrides.templateId);
    if (template) {
      format = template.template;
      const resolvedTarget = resolveSaveTarget(
        template,
        globalDefaultVault?.name,
        saveTargetDefaults.folder,
        saveTargetDefaults.filenamePattern
      );
      const effectiveVaultName = overrides.vaultName || resolvedTarget.vault;
      const effectiveFilename = overrides.filename || resolvedTarget.filename;
      const folderOverride = sanitizeText(overrides.folder);
      const folder = folderOverride || resolvedTarget.folder || "";

      obsidianVault = effectiveVaultName;
      obsidianNotePathSource = folder ? `${folder}/${effectiveFilename}` : effectiveFilename;
    }
  }

  if (!obsidianVault) {
    obsidianVault = sanitizeText(globalDefaultVault?.name);
  }

  const rawRestricted = Array.isArray(storage.restrictedUrls) && storage.restrictedUrls.length
    ? storage.restrictedUrls
    : DEFAULT_RESTRICTED_URLS;

  const obsidianNotePath = sanitizeNotePath(obsidianNotePathSource);
  const frontmatterFields = resolveFrontmatterFields(
    storage && typeof storage.frontmatterFieldNames === "object" ? storage.frontmatterFieldNames : undefined
  );
  const frontmatterTitleTemplate =
    typeof storage.frontmatterTitleTemplate === "string" && storage.frontmatterTitleTemplate.trim().length > 0
      ? storage.frontmatterTitleTemplate
      : DEFAULT_FRONTMATTER_TITLE_TEMPLATE;
  const frontmatterTagTemplates = Array.isArray(storage.frontmatterTagTemplates)
    ? storage.frontmatterTagTemplates.filter((entry) => typeof entry === "string")
    : DEFAULT_FRONTMATTER_TAG_TEMPLATES;
  const frontmatterCollectionTemplates = Array.isArray(storage.frontmatterCollectionTemplates)
    ? storage.frontmatterCollectionTemplates.filter((entry) => typeof entry === "string")
    : DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES;
  const frontmatterEnabled = resolveFrontmatterEnabled(
    storage && typeof storage.frontmatterEnabledFields === "object"
      ? storage.frontmatterEnabledFields
      : DEFAULT_FRONTMATTER_ENABLED_FIELDS
  );
  const exportDateFormat = sanitizeFormatSetting(storage.exportDateFormat, DEFAULT_EXPORT_DATE_FORMAT);
  const exportTimeFormat = sanitizeFormatSetting(storage.exportTimeFormat, DEFAULT_EXPORT_TIME_FORMAT);

  return {
    restrictedUrls: sanitizeRestrictedUrls(rawRestricted),
    markdownFormat: format,
    frontmatterFields,
    frontmatterEnabled,
    frontmatterTitleTemplate,
    frontmatterTagTemplates,
    frontmatterCollectionTemplates,
    timestampFormats: {
      dateFormat: exportDateFormat,
      timeFormat: exportTimeFormat
    },
    obsidian: {
      enabled: Boolean(obsidianVault && obsidianNotePath),
      vault: obsidianVault,
      notePath: obsidianNotePath
    }
  };
}

async function getActiveWindowTabs() {
  const windows = await browser.windows.getAll({ populate: true, windowTypes: ["normal"] });
  if (!windows || windows.length === 0) {
    return { window: null, tabs: [], tabGroups: {} };
  }
  const focused = windows.find((windowItem) => windowItem.focused) ?? windows[0];
  const windowMeta = {
    id: typeof focused.id === "number" ? focused.id : null,
    title: typeof focused.title === "string" ? focused.title : "",
    focused: Boolean(focused.focused),
    incognito: Boolean(focused.incognito)
  };
  const tabs = focused.tabs ?? [];
  const groupIds = [...new Set(tabs.map((tab) => (typeof tab.groupId === "number" ? tab.groupId : -1)).filter((id) => id >= 0))];
  let tabGroups = {};
  if (groupIds.length > 0 && browser?.tabGroups?.get) {
    try {
      tabGroups = await resolveTabGroups(tabs);
    } catch (error) {
      console.warn("tabSidian tab group lookup failed", error);
      tabGroups = {};
    }
  }
  return {
    window: windowMeta,
    tabs,
    tabGroups
  };
}

function selectTabs(tabs, restrictedUrls) {
  return selectSavableTabs(tabs, restrictedUrls);
}

// Renders the export and decides how it will reach Obsidian, without side effects.
// The popup uses this so it can perform the clipboard write and URI launch itself.
async function prepareExport(overrides = {}) {
  const {
    restrictedUrls,
    markdownFormat,
    frontmatterFields,
    frontmatterEnabled,
    frontmatterTitleTemplate,
    frontmatterTagTemplates,
    frontmatterCollectionTemplates,
    timestampFormats,
    obsidian
  } = await resolveUserPreferences(overrides);

  const { window: activeWindow, tabs, tabGroups } = await getActiveWindowTabs();
  const tabsToProcess = selectTabs(tabs, restrictedUrls);

  if (tabsToProcess.length === 0) {
    const activeTab = tabs.find((tab) => tab.active);
    const activeUrl = typeof activeTab?.url === "string" ? activeTab.url : "";
    return {
      status: "no_tabs",
      restrictedActiveTab: Boolean(activeUrl && isRestrictedUrl(activeUrl, restrictedUrls))
    };
  }

  const { markdown, formattedTimestamp, timestamp } = formatTabsMarkdown(tabsToProcess, markdownFormat, {
    window: activeWindow ?? undefined,
    frontmatterFields,
    frontmatterEnabled,
    tabGroups,
    frontmatterTitleTemplate,
    frontmatterTagTemplates,
    frontmatterCollectionTemplates,
    timestampFormats
  });

  const validation = validateExport({ markdown, tabs: tabsToProcess });
  if (!validation.ok) {
    emitMetric("export_validation_failed", { reason: validation.reason, tabCount: tabsToProcess.length });
    return { status: "invalid", reason: validation.reason };
  }
  if (validation.missingUrls.length > 0) {
    emitMetric("export_validation_partial_coverage", {
      missing: validation.missingUrls.length,
      coverage: validation.coverage
    });
  }

  const filename = obsidian?.notePath || `${formattedTimestamp}_OpenTabs.md`;

  let obsidianPlan = null;
  if (obsidian?.enabled) {
    const notePath = applyNotePathTemplate(obsidian.notePath, formattedTimestamp, timestamp);
    obsidianPlan = {
      notePath,
      ...planObsidianExport({
        vault: obsidian.vault,
        filepath: notePath,
        markdown,
        maxLength: MAX_OBSIDIAN_URI_LENGTH
      })
    };
    if (obsidianPlan.mode === "clipboard") {
      emitMetric("obsidian_export_clipboard_mode", {
        inlineLength: obsidianPlan.inlineLength,
        threshold: obsidianPlan.maxLength,
        notePath
      });
    }
  }

  return {
    status: "ready",
    markdown,
    filename,
    tabCount: tabsToProcess.length,
    obsidian: obsidianPlan
  };
}

async function notifyNoTabs(prepared) {
  if (prepared.restrictedActiveTab) {
    await notifyUser(
      "tabSidian can’t run on this page",
      "Browser system or extension pages don’t allow tab capture. Switch back to any website tab and try again."
    );
  }
}

async function notifyInvalidExport() {
  await notifyUser(
    "tabSidian export aborted",
    "The selected template produced an empty note, so nothing was sent. Check the template in tabSidian settings."
  );
}

async function notifyObsidianFailure(result) {
  const message =
    result.reason === "clipboard_unavailable" || result.reason === "clipboard_write_failed"
      ? "The tab list is too long to send to Obsidian directly and the clipboard was unavailable. A Markdown download will be offered instead."
      : "tabSidian could not open Obsidian. A Markdown download will be offered instead.";
  await notifyUser("tabSidian export issue", message);
}

// Background-only export path (toolbar click without popup, or the legacy SAVE_TABS message).
async function processExport(overrides = {}) {
  const prepared = await prepareExport(overrides);

  if (prepared.status === "no_tabs") {
    await notifyNoTabs(prepared);
    return prepared;
  }
  if (prepared.status === "invalid") {
    await notifyInvalidExport();
    return prepared;
  }

  if (prepared.obsidian) {
    const activeTab = await getActiveTab();
    const result = await sendExportToObsidian({
      markdown: prepared.markdown,
      plan: prepared.obsidian,
      launch: (url) => launchObsidianUri(url, { activeTab }),
      writeClipboard: writeClipboardText
    });
    if (result.success) {
      return { status: "sent", mode: result.mode };
    }
    await notifyObsidianFailure(result);
  }

  await deliverMarkdownFile({ markdown: prepared.markdown, filename: prepared.filename });
  return { status: "downloaded" };
}

const actionApi = browser.action ?? browser.browserAction;

if (actionApi?.onClicked?.addListener) {
  actionApi.onClicked.addListener(() => {
    processExport().catch((error) => {
      console.error("tabSidian failed to process tab click", error);
    });
  });
} else {
  console.error("tabSidian could not bind the browser action click handler.");
}

function handleMessage(message) {
  switch (message?.type) {
    case "SAVE_TABS":
      return processExport(message.payload).then(() => ({ ok: true }));
    case "PREPARE_EXPORT":
      return prepareExport(message.payload).then((prepared) => ({ ok: true, ...prepared }));
    case "DELIVER_DOWNLOAD": {
      const markdown = message.payload?.markdown;
      const filename = message.payload?.filename;
      if (typeof markdown !== "string" || markdown.trim().length === 0 || typeof filename !== "string") {
        return Promise.resolve({ ok: false, error: "Nothing to download." });
      }
      return deliverMarkdownFile({ markdown, filename }).then(() => ({ ok: true }));
    }
    case "LAUNCH_OBSIDIAN_NEW_TAB": {
      const url = message.payload?.url;
      if (typeof url !== "string" || !url.startsWith(`${OBSIDIAN_NEW_SCHEME}?`)) {
        return Promise.resolve({ success: false, reason: "invalid_url" });
      }
      return openObsidianInNewTab(url);
    }
    default:
      return undefined;
  }
}

browser.runtime.onMessage.addListener((message) => {
  const pending = handleMessage(message);
  if (!pending) {
    return undefined;
  }

  return pending.catch((error) => {
    console.error("tabSidian failed to process message", message?.type, error);
    return { ok: false, error: error?.message ?? "Export failed." };
  });
});

if (browser?.runtime?.onInstalled?.addListener) {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install" && browser?.runtime?.openOptionsPage) {
      browser.runtime
        .openOptionsPage()
        .catch((error) => console.warn("tabSidian failed to open options page after install", error));
    }
  });
}
