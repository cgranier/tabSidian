function matchesRestrictedUrl(url = "", restricted = []) {
  return restricted.some((pattern) => pattern && url.includes(pattern));
}

function isInternalUrl(url = "") {
  return ["edge://", "chrome://", "chrome-extension://", "moz-extension://", "about:", "extension://"].some((prefix) =>
    url.startsWith(prefix)
  );
}

function normalizeTabUrlCandidate(candidate) {
  return typeof candidate === "string" ? candidate : "";
}

/**
 * Determines the best export URL for a tab, rescuing discarded tabs that still report
 * an internal placeholder location (as seen in Arc's sleeping tabs).
 *
 * @param {import("webextension-polyfill").Tabs.Tab | undefined | null} tab
 * @returns {string}
 */
export function resolveTabUrl(tab) {
  if (!tab || typeof tab !== "object") {
    return "";
  }

  const url = normalizeTabUrlCandidate(tab.url);
  const pendingUrl = normalizeTabUrlCandidate(tab.pendingUrl);

  if (tab.discarded) {
    const primaryIsInternal = isInternalUrl(url) || url.length === 0;
    if (primaryIsInternal && pendingUrl && !isInternalUrl(pendingUrl)) {
      return pendingUrl;
    }
  }

  if (!url && pendingUrl) {
    return pendingUrl;
  }

  return url;
}

export function isRestrictedUrl(url = "", restricted = []) {
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }
  return isInternalUrl(url) || matchesRestrictedUrl(url, restricted);
}

export function shouldProcessTab(tab, restrictedUrls = [], processOnlySelectedTabs = false) {
  if (!tab || typeof tab !== "object") {
    return false;
  }

  const url = resolveTabUrl(tab);

  if (tab.pinned || isRestrictedUrl(url, restrictedUrls)) {
    return false;
  }

  if (!processOnlySelectedTabs) {
    return true;
  }

  return Boolean(tab.highlighted);
}

export function sanitizeRestrictedUrls(urls = []) {
  return urls.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
}
