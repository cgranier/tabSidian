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

function safeDecodeURIComponent(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }

  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function extractDiscardedPlaceholderUrl(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return "";
  }

  // Attempt to extract from known query parameters.
  try {
    const parsed = new URL(candidate);
    const queryKeys = ["url", "targetUrl", "rdl", "activationUrl"]; // observed Chromium keys

    for (const key of queryKeys) {
      const value = parsed.searchParams.get(key);
      if (typeof value === "string" && value.length > 0) {
        const decoded = safeDecodeURIComponent(value);
        if (decoded && !isInternalUrl(decoded)) {
          return decoded;
        }
      }
    }
  } catch (error) {
    // Ignore parsing failures and fall back to substring scanning below.
  }

  const searchSpace = [candidate];
  const decodedCandidate = safeDecodeURIComponent(candidate);
  if (decodedCandidate && decodedCandidate !== candidate) {
    searchSpace.push(decodedCandidate);
  }

  const embeddedUrlPattern = /(https?:\/\/[^\s"'<>]+)/i;
  for (const entry of searchSpace) {
    const match = typeof entry === "string" ? entry.match(embeddedUrlPattern) : null;
    if (match) {
      const value = match[1];
      if (value && !isInternalUrl(value)) {
        return value;
      }
    }
  }

  return "";
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
    if (primaryIsInternal) {
      if (pendingUrl && !isInternalUrl(pendingUrl)) {
        return pendingUrl;
      }

      const extracted = extractDiscardedPlaceholderUrl(url) || extractDiscardedPlaceholderUrl(pendingUrl);
      if (extracted) {
        return extracted;
      }
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
