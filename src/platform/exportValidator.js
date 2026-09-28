function collectTabUrls(tabs = []) {
  if (!Array.isArray(tabs)) {
    return [];
  }
  return [
    ...new Set(
      tabs
        .map((tab) => (typeof tab?.url === "string" ? tab.url.trim() : ""))
        .filter((url) => url.length > 0)
    )
  ];
}

// Checks a rendered export before it is handed to Obsidian or the clipboard.
// An empty export is a hard failure. URL coverage is reported but not enforced,
// because custom templates may legitimately omit URLs.
export function validateExport({ markdown, tabs = [] } = {}) {
  if (typeof markdown !== "string" || markdown.trim().length === 0) {
    return { ok: false, reason: "empty_export", coverage: 0, missingUrls: collectTabUrls(tabs) };
  }

  const urls = collectTabUrls(tabs);
  const missingUrls = urls.filter((url) => !markdown.includes(url));
  const coverage = urls.length === 0 ? 1 : (urls.length - missingUrls.length) / urls.length;

  return { ok: true, coverage, missingUrls };
}
