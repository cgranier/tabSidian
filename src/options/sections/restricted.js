export function parseRestrictedUrlsImportText(text) {
  let entries = null;

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      entries = parsed.map((value) => String(value));
    } else if (parsed && Array.isArray(parsed.restrictedUrls)) {
      entries = parsed.restrictedUrls.map((value) => String(value));
    }
  } catch (error) {
    // Fall back to newline parsing.
  }

  if (!entries) {
    entries = text
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return entries;
}

export function createRestrictedUrlsBlob(entries) {
  return new Blob([entries.join("\n")], { type: "text/plain" });
}

export function resolveRestrictedUrlsOnLoad({
  storedRestrictedUrls,
  defaultRestrictedUrls,
  legacyDefaultRestrictedUrls
}) {
  const hasStoredRestrictedUrls = Array.isArray(storedRestrictedUrls);
  const sanitizedStored = hasStoredRestrictedUrls
    ? storedRestrictedUrls.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    : [];

  const isLegacyDefault =
    JSON.stringify(sanitizedStored) === JSON.stringify(legacyDefaultRestrictedUrls ?? []);

  if (!hasStoredRestrictedUrls || isLegacyDefault) {
    return {
      restrictedUrls: defaultRestrictedUrls,
      shouldPersistDefaults: true
    };
  }

  return {
    restrictedUrls: sanitizedStored,
    shouldPersistDefaults: false
  };
}
