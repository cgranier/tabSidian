export const FRONTMATTER_FIELD_PATTERN = /^[A-Za-z0-9_\-]+$/;
export const MAX_FRONTMATTER_LIST_ENTRIES = 50;

export function sanitizeFrontmatterInput(value) {
  return (value ?? "").trim();
}

export function validateFrontmatterFieldName(value) {
  if (value.length === 0) {
    return "Field name is required.";
  }
  if (!FRONTMATTER_FIELD_PATTERN.test(value)) {
    return "Use letters, numbers, hyphen, or underscore.";
  }
  return "";
}

export function toTemplateMultiline(values = []) {
  return values.filter((value) => typeof value === "string" && value.trim().length > 0).join("\n");
}

export function parseTemplateMultiline(value) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function normalizeTemplateEntries(entries, maxEntries = MAX_FRONTMATTER_LIST_ENTRIES) {
  const unique = [];
  const seen = new Set();
  const duplicates = [];

  entries.forEach((entry) => {
    const key = entry.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(entry);
      return;
    }
    seen.add(key);
    unique.push(entry);
  });

  if (unique.length > maxEntries) {
    return {
      entries: unique.slice(0, maxEntries),
      duplicates,
      tooMany: true
    };
  }

  return {
    entries: unique,
    duplicates,
    tooMany: false
  };
}

