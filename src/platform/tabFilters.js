function matchesRestrictedUrl(url = "", restricted = []) {
  return restricted.some((pattern) => pattern && url.includes(pattern));
}

function isInternalUrl(url = "") {
  return ["edge://", "chrome://", "chrome-extension://", "moz-extension://", "about:", "extension://"].some((prefix) =>
    url.startsWith(prefix)
  );
}

export function shouldProcessTab(tab, restrictedUrls = [], processOnlySelectedTabs = false) {
  if (!tab || typeof tab !== "object") {
    return false;
  }

  const url = tab.url ?? "";

  if (tab.pinned || isInternalUrl(url) || matchesRestrictedUrl(url, restrictedUrls)) {
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
