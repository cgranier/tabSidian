import { DEFAULT_MARKDOWN_FORMAT, DEFAULT_FRONTMATTER_FIELDS } from "./markdown.js";

export const DEFAULT_RESTRICTED_URLS = [
  "chrome-extension://",
  "extension://",
  "moz-extension://",
  "safari-web-extension://",
  "edge://",
  "chrome://",
  "mail.google.com",
  "outlook.live.com"
];

export const DEFAULT_OBSIDIAN_NOTE_PATH = "tabSidian/tab-export-{timestamp}.md";

export { DEFAULT_MARKDOWN_FORMAT, DEFAULT_FRONTMATTER_FIELDS };
