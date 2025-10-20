export const DEFAULT_MARKDOWN_FORMAT = "## {title}\n[{url}]({url})\n\n";

function formatTimestamp() {
  const timestamp = new Date();
  const pad = (value) => value.toString().padStart(2, "0");

  const datePortion = `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}`;
  const timePortion = `${pad(timestamp.getHours())}-${pad(timestamp.getMinutes())}-${pad(timestamp.getSeconds())}`;

  const localDate = timestamp
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
    .split("/")
    .reverse()
    .join("-");

  const localTime = timestamp.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  return {
    formattedTimestamp: `${datePortion}T${timePortion}`,
    localDate,
    localTime
  };
}

function unescapeTitle(rawTitle) {
  if (typeof rawTitle !== "string" || rawTitle.length === 0) {
    return "";
  }

  const requiresDecoding = rawTitle.includes("+") || /%[0-9A-Fa-f]{2}/.test(rawTitle);
  const candidate = requiresDecoding ? rawTitle.replace(/\+/g, " ") : rawTitle;

  let decoded = candidate;
  if (requiresDecoding) {
    try {
      decoded = decodeURIComponent(candidate);
    } catch (error) {
      decoded = candidate;
    }
  }

  const trimmed = decoded.replace(/^\s+/, "");
  const withoutHashes = trimmed.replace(/^#+\s*/, "");
  return withoutHashes.length > 0 ? withoutHashes : trimmed;
}

function applyTemplate(markdownFormat, tab) {
  const title = unescapeTitle(tab.title ?? "");
  const url = tab.url ?? "";

  return markdownFormat
    .replace(/\{title\}/g, title)
    .replace(/\{url\}/g, url)
    .replace(/\\n/g, "\n");
}

export function formatTabsMarkdown(tabs, markdownFormat = DEFAULT_MARKDOWN_FORMAT) {
  const { formattedTimestamp, localDate, localTime } = formatTimestamp();

  const header = ["---", `date_created: ${localDate}`, `time_created: ${localTime}`, "---", ""].join("\n");

  const body = tabs
    .map((tab) => applyTemplate(markdownFormat, tab))
    .join("");

  return {
    markdown: `${header}${body}`,
    formattedTimestamp
  };
}
