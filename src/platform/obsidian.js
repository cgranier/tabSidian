export const OBSIDIAN_NEW_SCHEME = "obsidian://new";

export function buildObsidianUrl({
  vault,
  filepath,
  content,
  clipboard = false,
  overwrite = true,
  silent = false
}) {
  const queryParts = [];

  const append = (key, value) => {
    if (value === undefined || value === null) {
      return;
    }
    const stringValue = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
    if (stringValue.length === 0) {
      return;
    }
    queryParts.push(`${key}=${encodeURIComponent(stringValue)}`);
  };

  append("file", filepath);
  if (overwrite) {
    append("overwrite", "true");
  }
  append("vault", vault);
  if (clipboard) {
    append("clipboard", "true");
  }
  if (silent) {
    append("silent", "true");
  }
  if (typeof content === "string") {
    append("content", content);
  }

  const query = queryParts.join("&");
  const url = query.length > 0 ? `${OBSIDIAN_NEW_SCHEME}?${query}` : OBSIDIAN_NEW_SCHEME;
  return {
    url,
    totalLength: url.length
  };
}
