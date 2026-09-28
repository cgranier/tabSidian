import browser from "./browser.js";
import { emitMetric } from "./metrics.js";

const NAVIGATION_VERIFICATION_DELAY_MS = 200;
const NEW_TAB_CLEANUP_DELAY_MS = 750;

const RESTRICTED_NAVIGATION_PREFIXES = [
  "chrome://",
  "edge://",
  "vivaldi://",
  "about:",
  "chrome-extension://",
  "moz-extension://",
  "edge-extension://",
  "safari-web-extension://",
  "extension://"
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isRestrictedNavigationUrl(url) {
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }
  return RESTRICTED_NAVIGATION_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function isBlankUrl(url) {
  if (typeof url !== "string") {
    return true;
  }

  const trimmed = url.trim();
  return trimmed.length === 0 || trimmed === "about:blank";
}

// Chromium-based browsers (notably Vivaldi) will resolve `tabs.update`
// even when they refuse to hand the custom protocol to the OS. In that
// situation the tab reports the requested URL in `pendingUrl`, keeps its
// visible `url` blank/about:blank, and sits forever in the "loading"
// state. Detect that pattern so we can fall back to the new-tab transport.
export function isSuppressedNavigation(tabInfo, targetUrl) {
  if (!tabInfo || typeof targetUrl !== "string") {
    return false;
  }

  const pendingUrl = typeof tabInfo.pendingUrl === "string" ? tabInfo.pendingUrl : "";
  const currentUrl = typeof tabInfo.url === "string" ? tabInfo.url : "";

  if (pendingUrl !== targetUrl) {
    return false;
  }

  if (!isBlankUrl(currentUrl)) {
    return false;
  }

  if (typeof tabInfo.status === "string" && tabInfo.status !== "loading") {
    return false;
  }

  return true;
}

async function verifyNavigationSucceeded(tabId, targetUrl) {
  if (!browser?.tabs?.get) {
    return true;
  }

  try {
    const refreshed = await browser.tabs.get(tabId);
    return !isSuppressedNavigation(refreshed, targetUrl);
  } catch (error) {
    console.warn("tabSidian could not verify Obsidian navigation state", error);
    return false;
  }
}

async function updateActiveTab(url, activeTab) {
  try {
    if (!activeTab?.id) {
      return { success: false, reason: "no_active_tab" };
    }

    const updatedTab = await browser.tabs.update(activeTab.id, { url });

    if (isSuppressedNavigation(updatedTab, url)) {
      await delay(NAVIGATION_VERIFICATION_DELAY_MS);
      const verified = await verifyNavigationSucceeded(activeTab.id, url);
      if (!verified) {
        emitMetric("obsidian_export_navigation_blocked", { reason: "tab_update_suppressed" });
        return { success: false, reason: "tab_update_suppressed" };
      }
    }

    emitMetric("obsidian_export_navigation", { transport: "tab_update" });
    return { success: true, transport: "tab_update" };
  } catch (error) {
    console.error("tabSidian failed to route Obsidian URI through active tab", error);
    emitMetric("obsidian_export_navigation_failed", { reason: error?.message ?? "update_failed" });
    return { success: false, reason: error?.message ?? "update_failed" };
  }
}

// Must run in the background context: activating a new tab closes the popup, which would
// cancel the cleanup timer and leave the helper tab behind.
export async function openObsidianInNewTab(url) {
  if (!browser?.tabs?.create) {
    return { success: false, reason: "no_tabs_api" };
  }

  try {
    const createdTab = await browser.tabs.create({ url, active: true });

    if (createdTab?.id) {
      setTimeout(() => {
        browser.tabs.remove(createdTab.id).catch(() => {
          // tab may already be gone; ignore cleanup failures
        });
      }, NEW_TAB_CLEANUP_DELAY_MS);
    }

    emitMetric("obsidian_export_navigation", { transport: "new_tab" });
    return { success: true, transport: "new_tab" };
  } catch (error) {
    console.error("tabSidian failed to invoke Obsidian via navigation", error);
    emitMetric("obsidian_export_navigation_failed", { reason: error?.message ?? "unknown" });
    return { success: false, reason: error?.message ?? "navigation_failed" };
  }
}

export async function getActiveTab() {
  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    return activeTab;
  } catch (error) {
    console.warn("tabSidian could not resolve the active tab", error);
    return undefined;
  }
}

// Hands an obsidian:// URI to the OS. Browser-internal pages refuse protocol navigation,
// so those go straight to the new-tab transport instead of being reported as failures.
// Callers outside the background pass `openNewTab` to delegate that transport to it.
export async function launchObsidianUri(url, { activeTab, openNewTab = openObsidianInNewTab } = {}) {
  let updateResult = { success: false, reason: "skipped" };
  if (activeTab?.id && !isRestrictedNavigationUrl(activeTab.url) && browser?.tabs?.update) {
    updateResult = await updateActiveTab(url, activeTab);
    if (updateResult.success) {
      return updateResult;
    }
  }

  const newTabResult = await openNewTab(url);
  if (newTabResult?.success) {
    return newTabResult;
  }

  return {
    success: false,
    reason: newTabResult?.reason ?? updateResult.reason ?? "navigation_failed"
  };
}
