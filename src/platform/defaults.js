import {
  DEFAULT_MARKDOWN_FORMAT,
  DEFAULT_FRONTMATTER_FIELDS,
  DEFAULT_FRONTMATTER_ENABLED_FIELDS,
  DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
  DEFAULT_FRONTMATTER_TAG_TEMPLATES,
  DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES,
  DEFAULT_EXPORT_DATE_FORMAT,
  DEFAULT_EXPORT_TIME_FORMAT
} from "./markdown.js";

export const DEFAULT_RESTRICTED_URLS = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "vivaldi://",
  "brave://",
  "opera://",
  "safari://",
  "safari-web-extension://",
  "moz-extension://",
  "extension://",
  "about:",
  "view-source:",
  "file://",
  "devtools://",
  "blob:",
  "data:",
  "mail.google.com",
  "inbox.google.com",
  "outlook.live.com",
  "outlook.office.com",
  "owa.office365.com",
  "yahoo.com/mail",
  "proton.me/mail",
  "icloud.com/mail",
  "fastmail.com",
  "meet.google.com",
  "zoom.us",
  "teams.microsoft.com",
  "slack.com",
  "discord.com/channels/",
  "web.whatsapp.com",
  "signal.org",
  "telegram.org",
  "messenger.com",
  "docs.google.com/presentation/",
  "docs.google.com/spreadsheets/",
  "docs.google.com/document/",
  "colab.research.google.com",
  "figma.com/file/",
  "miro.com/app/board/",
  "notion.so",
  "canva.com/design/",
  "codesandbox.io",
  "replit.com",
  "stackblitz.com",
  "accounts.google.com",
  "login.microsoftonline.com",
  "login.live.com",
  "chrome.google.com/webstore/",
  "addons.mozilla.org",
  "edge.microsoft.com/addons/",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "example.com",
  "test.com",
  "blank"
];

export const DEFAULT_OBSIDIAN_NOTE_PATH = "tabSidian/tab-export-{timestamp}.md";

export const DEFAULT_VAULTS = [];

export const DEFAULT_TEMPLATES = [];

export const BUILT_IN_PRESETS = [
  {
    id: "builtin:default",
    name: "Default headings",
    description: "Frontmatter with level-two headings per tab.",
    template: DEFAULT_MARKDOWN_FORMAT
  },
  {
    id: "builtin:list",
    name: "Compact list",
    description: "Frontmatter followed by a bullet list of tabs.",
    template: `{{{frontmatter}}}
{{#tabs}}
- [{{title}}]({{url}})
{{/tabs}}`
  },
  {
    id: "builtin:metadata",
    name: "Metadata summary",
    description: "Adds hostname and timestamps under each tab entry.",
    template: `{{{frontmatter}}}
{{#tabs}}
## {{title}}
- URL: {{url}}
- Host: {{hostname}}
{{#favicon}}- Favicon: {{favicon}}{{/favicon}}
{{#timestamps.lastAccessed}}- Last visited: {{timestamps.lastAccessed}} ({{timestamps.lastAccessedRelative}}){{/timestamps.lastAccessed}}
{{^timestamps.lastAccessed}}- Last visited: unknown{{/timestamps.lastAccessed}}

{{/tabs}}`
  },
  {
    id: "builtin:grouped",
    name: "Grouped headings",
    description: "Organises output by tab group when available.",
    template: `{{{frontmatter}}}
{{#groups}}
## {{title}}
{{#tabs}}- [{{title}}]({{url}})
{{/tabs}}

{{/groups}}
{{#ungroupedTabs}}
## {{title}}
[{{url}}]({{url}})

{{/ungroupedTabs}}`
  }
];

export {
  DEFAULT_MARKDOWN_FORMAT,
  DEFAULT_FRONTMATTER_FIELDS,
  DEFAULT_FRONTMATTER_ENABLED_FIELDS,
  DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
  DEFAULT_FRONTMATTER_TAG_TEMPLATES,
  DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES,
  DEFAULT_EXPORT_DATE_FORMAT,
  DEFAULT_EXPORT_TIME_FORMAT
};
