export const OBSIDIAN_NEW_SCHEME = "obsidian://new";

// Windows and macOS custom protocol handlers begin rejecting requests above ~20k characters.
// Firefox tolerates larger URIs, so it keeps the previous ~60k ceiling; Chromium-based builds use ~18k.
export const MAX_OBSIDIAN_URI_LENGTH_DEFAULT = 18000;
export const MAX_OBSIDIAN_URI_LENGTH_FIREFOX = 60000;

export function resolveMaxObsidianUriLength({ isFirefox = false } = {}) {
  return isFirefox ? MAX_OBSIDIAN_URI_LENGTH_FIREFOX : MAX_OBSIDIAN_URI_LENGTH_DEFAULT;
}

export function buildObsidianUrl({
  vault,
  filepath,
  content,
  clipboard = false,
  overwrite = true,
  silent = false
}) {
  // Obsidian ignores `content` when `clipboard=true` and imports the system clipboard instead,
  // so sending both would silently drop the rendered export (see issue #33).
  if (clipboard && typeof content === "string") {
    throw new Error("Obsidian URIs cannot combine clipboard=true with content.");
  }

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

// Chooses how the export reaches Obsidian:
// - "inline": the rendered Markdown travels in `content=` (preferred, no clipboard involved).
// - "clipboard": the URI is too long, so the caller must write the Markdown to the clipboard
//   from a trusted extension context and launch a URI that carries `clipboard=true` only.
export function planObsidianExport({ vault, filepath, markdown, maxLength = MAX_OBSIDIAN_URI_LENGTH_DEFAULT }) {
  const baseParams = { vault, filepath, overwrite: true };
  const inline = buildObsidianUrl({ ...baseParams, content: markdown });
  if (inline.totalLength <= maxLength) {
    return { mode: "inline", url: inline.url, totalLength: inline.totalLength, inlineLength: inline.totalLength, maxLength };
  }

  const clipboard = buildObsidianUrl({ ...baseParams, clipboard: true });
  return {
    mode: "clipboard",
    url: clipboard.url,
    totalLength: clipboard.totalLength,
    inlineLength: inline.totalLength,
    maxLength
  };
}
