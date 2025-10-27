function matchesRestrictedUrl(url = "", restricted = []) {
  return restricted.some((pattern) => pattern && url.includes(pattern));
}

function isInternalUrl(url = "") {
  return ["edge://", "chrome://", "chrome-extension://", "moz-extension://", "about:", "extension://"].some((prefix) =>
    url.startsWith(prefix)
  );
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

  const url = tab.url ?? "";

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
