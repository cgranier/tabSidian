import browser from "../platform/browser.js";
import {
  DEFAULT_MARKDOWN_FORMAT,
  DEFAULT_OBSIDIAN_NOTE_PATH,
  DEFAULT_RESTRICTED_URLS
} from "../platform/defaults.js";
import { deliverMarkdownFile } from "../platform/download.js";
import { formatTabsMarkdown } from "../platform/markdown.js";
import { sanitizeRestrictedUrls, shouldProcessTab } from "../platform/tabFilters.js";
import { IS_FIREFOX, IS_CHROMIUM } from "../platform/runtime.js";

const OBSIDIAN_NEW_SCHEME = "obsidian://new";
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

function applyNotePathTemplate(notePath, formattedTimestamp) {
  return notePath.replace(/\{timestamp\}/g, formattedTimestamp);
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

function buildObsidianUrl({ vault, filepath, content, clipboard = false, overwrite = true, silent = false }) {
  const params = new URLSearchParams();
  params.set("file", filepath);
  if (overwrite) {
    params.set("overwrite", "true");
  }
  if (vault) {
    params.set("vault", vault);
  }
  if (clipboard) {
    params.set("clipboard", "true");
  }
  if (silent) {
    params.set("silent", "true");
  }

  let query = params.toString();
  if (typeof content === "string") {
    const prefix = query.length > 0 ? "&" : "";
    query = `${query}${prefix}content=${encodeURIComponent(content)}`;
  }

  const url = `${OBSIDIAN_NEW_SCHEME}?${query}`;
  return {
    url,
    totalLength: url.length
  };
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

function isRestrictedClipboardUrl(url) {
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }
  return /^(chrome|edge|about):/.test(url);
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

async function resolveUserPreferences() {
  const storage = await browser.storage.sync.get([
    "restrictedUrls",
    "markdownFormat",
    "obsidianVault",
    "obsidianNotePath"
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

  return {
    restrictedUrls: sanitizeRestrictedUrls(rawRestricted),
    markdownFormat: format,
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
    return { window: null, tabs: [] };
  }
  const focused = windows.find((windowItem) => windowItem.focused) ?? windows[0];
  const windowMeta = {
    id: typeof focused.id === "number" ? focused.id : null,
    title: typeof focused.title === "string" ? focused.title : "",
    focused: Boolean(focused.focused),
    incognito: Boolean(focused.incognito)
  };
  return {
    window: windowMeta,
    tabs: focused.tabs ?? []
  };
}

function selectTabs(tabs, restrictedUrls) {
  const selectedTabs = tabs.filter((tab) => tab.highlighted);
  const processOnlySelectedTabs = selectedTabs.length > 1;
  return tabs.filter((tab) => shouldProcessTab(tab, restrictedUrls, processOnlySelectedTabs));
}

async function exportToObsidian({ markdown, formattedTimestamp, obsidian }) {
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

  const resolvedNotePath = applyNotePathTemplate(obsidian.notePath, formattedTimestamp);
  const baseParams = {
    vault: obsidian.vault,
    filepath: resolvedNotePath,
    overwrite: true
  };

  if (restrictedActiveTab) {
    await notifyUser(
      "tabSidian can’t run on this page",
      "Browser system pages (edge://, chrome://, about:) don’t allow Obsidian exports. Switch back to an http or https tab and try again."
    );
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
    await notifyUser(
      "tabSidian export blocked",
      "Browser system pages (like edge://extensions) do not allow launching Obsidian. Switch back to a regular webpage and try again."
    );
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
  const { restrictedUrls, markdownFormat, obsidian } = await resolveUserPreferences();
  const { window: activeWindow, tabs } = await getActiveWindowTabs();
  const tabsToProcess = selectTabs(tabs, restrictedUrls);

  if (tabsToProcess.length === 0) {
    return;
  }

  const { markdown, formattedTimestamp } = formatTabsMarkdown(tabsToProcess, markdownFormat, {
    window: activeWindow ?? undefined
  });
  const filename = `${formattedTimestamp}_OpenTabs.md`;

  const obsidianResult = await exportToObsidian({ markdown, formattedTimestamp, obsidian });
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
