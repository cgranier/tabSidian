import browser from "../platform/browser.js";
import {
  DEFAULT_MARKDOWN_FORMAT,
  DEFAULT_OBSIDIAN_NOTE_PATH,
  DEFAULT_RESTRICTED_URLS,
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
import { sanitizeRestrictedUrls, shouldProcessTab, isRestrictedUrl } from "../platform/tabFilters.js";
import { IS_FIREFOX, IS_CHROMIUM } from "../platform/runtime.js";
import { buildObsidianUrl, OBSIDIAN_NEW_SCHEME } from "../platform/obsidian.js";
const NOTIFICATION_ICON = "icon128.png";
// Windows and macOS custom protocol handlers begin rejecting requests above ~20k characters.
// Firefox tolerates larger URIs, so it keeps the previous ~60k ceiling; Chromium-based builds use ~18k.
const MAX_OBSIDIAN_URI_LENGTH = IS_FIREFOX ? 60000 : 18000;

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeNotePath(value) {
  const sanitized = sanitizeText(value)
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("/");

  if (!sanitized) {
    return "";
  }

  const withExtension = sanitized.toLowerCase().endsWith(".md") ? sanitized : `${sanitized}.md`;

  if (/(^|\/)(\.{1,2})(\/|$)/.test(withExtension)) {
    return "";
  }

  return withExtension;
}

function sanitizeFilenameSegment(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  return trimmed.replace(/[\\/:*?"<>|]/g, "-");
}

function applyNotePathTemplate(notePath, formattedTimestamp, timestamp) {
  let resolved = notePath.replace(/\{timestamp\}/g, formattedTimestamp);
  if (timestamp && timestamp.local) {
    const dateSegment = sanitizeFilenameSegment(timestamp.local.date);
    const timeSegment = sanitizeFilenameSegment(timestamp.local.time);
    resolved = resolved.replace(/\{date\}/g, dateSegment).replace(/\{time\}/g, timeSegment);
  } else {
    resolved = resolved.replace(/\{date\}/g, formattedTimestamp).replace(/\{time\}/g, formattedTimestamp);
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

function canInvokeObsidian() {
  if (!browser?.tabs?.update) {
    return false;
  }

  try {
    // eslint-disable-next-line no-new
    new URL(OBSIDIAN_NEW_SCHEME);
    return true;
  } catch (error) {
    console.warn("tabSidian cannot construct an Obsidian URI", error);
    return false;
  }
}

async function getActiveTab() {
  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    return activeTab;
  } catch (error) {
    console.warn("tabSidian could not resolve the active tab", error);
    return undefined;
  }
}

async function updateActiveTab(url, activeTab) {
  try {
    if (!activeTab?.id) {
      return { success: false, reason: "no_active_tab" };
    }

    await browser.tabs.update(activeTab.id, { url });
    emitMetric("obsidian_export_navigation", { transport: "tab_update" });
    return { success: true, transport: "tab_update" };
  } catch (error) {
    console.error("tabSidian failed to route Obsidian URI through active tab", error);
    emitMetric("obsidian_export_navigation_failed", { reason: error?.message ?? "update_failed" });
    return { success: false, reason: error?.message ?? "update_failed" };
  }
}

async function navigateObsidianProtocol(url) {
  if (!browser?.tabs?.create) {
    return { success: false, reason: "no_tabs_api" };
  }

  try {
    const createdTab = await browser.tabs.create({
      url,
      active: true
    });

    if (createdTab?.id) {
      setTimeout(() => {
        browser.tabs
          .remove(createdTab.id)
          .catch(() => {
            // tab may already be gone; ignore cleanup failures
          });
      }, 750);
    }

    emitMetric("obsidian_export_navigation", { transport: "new_tab" });
    return { success: true, transport: "new_tab" };
  } catch (error) {
    console.error("tabSidian failed to invoke Obsidian via navigation", error);
    emitMetric("obsidian_export_navigation_failed", { reason: error?.message ?? "unknown" });
    return { success: false, reason: error?.message ?? "navigation_failed" };
  }
}

function clipboardInjectionExecutor(text, preferNavigator = true) {
  function execCommandCopy() {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.left = "-9999px";

      document.body.appendChild(textarea);
      const selection = window.getSelection();
      const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      textarea.focus();
      textarea.select();

      const successful = document.execCommand("copy");

      textarea.remove();
      if (previousRange && selection) {
        selection.removeAllRanges();
        selection.addRange(previousRange);
      }

      if (successful) {
        return { success: true, method: "execCommand" };
      }

      return { success: false, method: "execCommand_failed" };
    } catch (error) {
      return { success: false, method: "execCommand_error", message: error?.message ?? String(error) };
    }
  }

  if (preferNavigator && navigator?.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => ({ success: true, method: "navigator" }))
      .catch((error) => {
        const fallback = execCommandCopy();
        if (!fallback.success && !fallback.message) {
          fallback.message = error?.message ?? String(error);
        }
        return fallback;
      });
  }

  return execCommandCopy();
}

const RESTRICTED_CLIPBOARD_PREFIXES = [
  "chrome://",
  "edge://",
  "about:",
  "chrome-extension://",
  "moz-extension://",
  "edge-extension://",
  "safari-web-extension://",
  "extension://"
];

function isRestrictedClipboardUrl(url) {
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }

  return RESTRICTED_CLIPBOARD_PREFIXES.some((prefix) => url.startsWith(prefix));
}

async function writeClipboardFromExtension(text) {
  if (!navigator?.clipboard?.writeText) {
    return { success: false, reason: "background_clipboard_unavailable" };
  }

  try {
    await navigator.clipboard.writeText(text);
    return { success: true, method: "background_clipboard" };
  } catch (error) {
    console.error("tabSidian background clipboard write failed", error);
    return {
      success: false,
      reason: "background_clipboard_failed",
      message: error?.message ?? String(error)
    };
  }
}

async function copyMarkdownToClipboard(markdown, activeTab) {
  if (!activeTab?.id) {
    return { success: false, reason: "no_active_tab" };
  }

  const activeTabRestricted = isRestrictedClipboardUrl(activeTab.url);
  if (activeTabRestricted) {
    const backgroundResult = await writeClipboardFromExtension(markdown);
    if (backgroundResult.success) {
      return { ...backgroundResult, restrictedActiveTab: true };
    }
    emitMetric("obsidian_clipboard_copy_skipped", {
      reason: "restricted_url",
      fallback: backgroundResult.reason
    });
    return { ...backgroundResult, restrictedActiveTab: true };
  }

  const preferNavigatorClipboard = !IS_CHROMIUM;

  async function attemptInjection(useNavigator) {
    const [result] = await browser.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: clipboardInjectionExecutor,
      args: [markdown, useNavigator]
    });
    return result?.result ?? result;
  }

  if (browser?.scripting?.executeScript) {
    try {
      let payload = await attemptInjection(preferNavigatorClipboard);
      if (!payload?.success) {
        if (preferNavigatorClipboard) {
          const retryPayload = await attemptInjection(false);
          if (retryPayload?.success) {
            return retryPayload;
          }
          payload = retryPayload ?? payload;
        }

        const backgroundResult = await writeClipboardFromExtension(markdown);
        if (backgroundResult.success) {
          return backgroundResult;
        }

        if (!preferNavigatorClipboard) {
          payload = await attemptInjection(true);
        }
      }
      if (payload?.success) {
        return { success: true, method: payload.method ?? "unknown" };
      }

      return {
        success: false,
        reason: payload?.method ?? "copy_failed",
        message: payload?.message
      };
    } catch (error) {
      console.error("tabSidian clipboard injection failed", error);
      return { success: false, reason: "scripting_failed", message: error?.message ?? String(error) };
    }
  }

  if (browser?.tabs?.executeScript) {
    try {
      async function legacyAttempt(useNavigator) {
        const injection = `(${clipboardInjectionExecutor.toString()})(${JSON.stringify(markdown)}, ${useNavigator});`;
        const results = await browser.tabs.executeScript(activeTab.id, { code: injection });
        return Array.isArray(results) ? results[0] : results;
      }

      let payload = await legacyAttempt(preferNavigatorClipboard);
      if (!payload?.success) {
        if (preferNavigatorClipboard) {
          const retryPayload = await legacyAttempt(false);
          if (retryPayload?.success) {
            return retryPayload;
          }
          payload = retryPayload ?? payload;
        }

        const backgroundResult = await writeClipboardFromExtension(markdown);
        if (backgroundResult.success) {
          return backgroundResult;
        }

        if (!preferNavigatorClipboard) {
          payload = await legacyAttempt(true);
        }
      }

      if (payload?.success) {
        return { success: true, method: payload.method ?? "unknown" };
      }

      return {
        success: false,
        reason: payload?.method ?? "copy_failed",
        message: payload?.message
      };
    } catch (error) {
      console.error("tabSidian legacy clipboard injection failed", error);
      return { success: false, reason: "legacy_injection_failed", message: error?.message ?? String(error) };
    }
  }

  return { success: false, reason: "unsupported" };
}

function emitMetric(event, detail = {}) {
  try {
    const payload = JSON.stringify({ event, ...detail });
    console.info("tabSidian.metric", payload);
  } catch (error) {
    console.info("tabSidian.metric", event, detail);
  }
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

async function resolveUserPreferences() {
  const storage = await browser.storage.sync.get([
    "restrictedUrls",
    "markdownFormat",
    "obsidianVault",
    "obsidianNotePath",
    "frontmatterFieldNames",
    "frontmatterTitleTemplate",
    "frontmatterTagTemplates",
    "frontmatterCollectionTemplates",
    "frontmatterEnabledFields",
    "exportDateFormat",
    "exportTimeFormat"
  ]);

  const rawRestricted = Array.isArray(storage.restrictedUrls) && storage.restrictedUrls.length
    ? storage.restrictedUrls
    : DEFAULT_RESTRICTED_URLS;

  const format = typeof storage.markdownFormat === "string" && storage.markdownFormat.trim().length > 0
    ? storage.markdownFormat
    : DEFAULT_MARKDOWN_FORMAT;

  const obsidianVault = sanitizeText(storage.obsidianVault);
  const obsidianNotePathSource =
    typeof storage.obsidianNotePath === "string" && storage.obsidianNotePath.trim().length > 0
      ? storage.obsidianNotePath
      : DEFAULT_OBSIDIAN_NOTE_PATH;
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
  const selectedTabs = tabs.filter((tab) => tab.highlighted);
  const processOnlySelectedTabs = selectedTabs.length > 1;
  return tabs.filter((tab) => shouldProcessTab(tab, restrictedUrls, processOnlySelectedTabs));
}

async function exportToObsidian({ markdown, formattedTimestamp, timestamp, obsidian }) {
  if (!obsidian?.enabled) {
    return { attempted: false, success: false };
  }

  if (!canInvokeObsidian()) {
    emitMetric("obsidian_export_skipped", { reason: "unsupported" });
    return { attempted: false, success: false };
  }

  const activeTab = await getActiveTab();
  const clipboardResult = await copyMarkdownToClipboard(markdown, activeTab);
  const restrictedActiveTab = clipboardResult.restrictedActiveTab === true;

  emitMetric("obsidian_clipboard_copy", {
    status: clipboardResult.success ? "success" : "failed",
    reason: clipboardResult.success ? undefined : clipboardResult.reason
  });

  const resolvedNotePath = applyNotePathTemplate(obsidian.notePath, formattedTimestamp, timestamp);
  const baseParams = {
    vault: obsidian.vault,
    filepath: resolvedNotePath,
    overwrite: true
  };

  if (restrictedActiveTab) {
    await notifyUser("tabSidian can’t run on this page", "Browser system or extension pages (edge://, chrome://, moz-extension://, etc.) don’t allow Obsidian exports. Switch back to an http or https tab and try again.");
    return { attempted: true, success: false, reason: "restricted_active_tab" };
  }

  let urlInfo;
  if (clipboardResult.success) {
    const combinedUrl = buildObsidianUrl({
      ...baseParams,
      clipboard: true,
      content: markdown
    });

    if (combinedUrl.totalLength <= MAX_OBSIDIAN_URI_LENGTH) {
      urlInfo = combinedUrl;
    } else {
      emitMetric("obsidian_export_content_omitted", {
        reason: "uri_too_long",
        length: combinedUrl.totalLength,
        threshold: MAX_OBSIDIAN_URI_LENGTH,
        notePath: resolvedNotePath
      });
      await notifyUser(
        "tabSidian export trimmed for Obsidian",
        "The tab list was copied to your clipboard and the note was created via Obsidian’s clipboard import. If the new note opens empty, paste (Ctrl+V) to insert the captured tabs."
      );

      urlInfo = buildObsidianUrl({
        ...baseParams,
        clipboard: true
      });
    }
  } else {
    urlInfo = buildObsidianUrl({
      ...baseParams,
      content: markdown
    });
  }

  if (!restrictedActiveTab && !clipboardResult.success && urlInfo.totalLength > MAX_OBSIDIAN_URI_LENGTH) {
    emitMetric("obsidian_export_skipped", {
      reason: "url_too_long",
      length: urlInfo.totalLength,
      notePath: resolvedNotePath
    });
    return { attempted: true, success: false, reason: "url_too_long" };
  }

  let updateResult = { success: false, reason: restrictedActiveTab ? "restricted_active_tab" : undefined };
  if (!restrictedActiveTab) {
    updateResult = await updateActiveTab(urlInfo.url, activeTab);
    if (updateResult.success) {
      emitMetric("obsidian_export_success", {
        notePath: resolvedNotePath,
        transport: updateResult.transport ?? "tab_update"
      });
      return { attempted: true, success: true, transport: updateResult.transport ?? "tab_update" };
    }
  }

  const navigationResult = await navigateObsidianProtocol(urlInfo.url);
  if (navigationResult.success) {
    emitMetric("obsidian_export_success", {
      notePath: resolvedNotePath,
      transport: navigationResult.transport ?? "new_tab"
    });
    return { attempted: true, success: true, transport: navigationResult.transport ?? "new_tab" };
  }

  emitMetric("obsidian_export_failed", {
    reason: navigationResult.reason ?? updateResult.reason ?? "navigation_failed",
    notePath: resolvedNotePath
  });
  console.error("tabSidian Obsidian navigation failed", navigationResult.reason ?? updateResult.reason);

  if (restrictedActiveTab) {
    await notifyUser("tabSidian export blocked", "Browser system or extension pages (like edge://extensions) do not allow launching Obsidian. Switch back to a regular webpage and try again.");
    return { attempted: true, success: false, reason: "restricted_active_tab" };
  }

  const detailMessage =
    navigationResult.reason === "no_tabs_api" || updateResult.reason === "no_tabs_api"
      ? "This browser disallowed opening Obsidian via the Advanced URI handler. A Markdown download will be offered instead."
      : "tabSidian could not open Obsidian via the Advanced URI handler. A Markdown download will be offered instead.";

  await notifyUser("tabSidian export issue", detailMessage);
  return {
    attempted: true,
    success: false,
    reason: navigationResult.reason ?? updateResult.reason ?? "navigation_failed"
  };
}

async function handleClick() {
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
  } = await resolveUserPreferences();
  const { window: activeWindow, tabs, tabGroups } = await getActiveWindowTabs();
  const tabsToProcess = selectTabs(tabs, restrictedUrls);

  if (tabsToProcess.length === 0) {
    const activeTab = tabs.find((tab) => tab.active);
    const activeUrl = typeof activeTab?.url === "string" ? activeTab.url : "";
    if (activeUrl && isRestrictedUrl(activeUrl, restrictedUrls)) {
      await notifyUser(
        "tabSidian can’t run on this page",
        "Browser system or extension pages don’t allow tab capture. Switch back to any website tab and try again."
      );
    }
    return;
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
  const filename = `${formattedTimestamp}_OpenTabs.md`;

  const obsidianResult = await exportToObsidian({ markdown, formattedTimestamp, timestamp, obsidian });
  if (obsidianResult.success) {
    return;
  }
  if (obsidianResult.reason === "restricted_active_tab") {
    return;
  }

  await deliverMarkdownFile({ markdown, filename });
}

const actionApi = browser.action ?? browser.browserAction;

if (actionApi?.onClicked?.addListener) {
  actionApi.onClicked.addListener(() => {
    handleClick().catch((error) => {
      console.error("tabSidian failed to export tabs:", error);
    });
  });
} else {
  console.error("tabSidian could not bind the browser action click handler.");
}

if (browser?.runtime?.onInstalled?.addListener) {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install" && browser?.runtime?.openOptionsPage) {
      browser.runtime
        .openOptionsPage()
        .catch((error) => console.warn("tabSidian failed to open options page after install", error));
    }
  });
}
