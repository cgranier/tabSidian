# tabSidian Help Guide

## Install tabSidian

Get the tabSidian extension from the official directory for your browser:

- **[Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tabsidian/gdnfbdjmfnpnjccfbppkbpjlpnppinba)**: For Microsoft Edge.
- **[Chrome Web Store](https://chromewebstore.google.com/detail/tabsidian/khooafbfmbbcjcbbfdkpceobdkdgpoic)**: For Chrome, Brave, Arc, Orion, and other Chromium-based browsers.
- **[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tabsidian/)**: For Firefox.
- **[Safari Extensions](placeholder)**: For macOS, iOS, and iPadOS. - Coming soon.

Download or install the version for your browser, then pin the tabSidian icon if you want quick access from the toolbar.

---

## How to Use tabSidian

### Initial setup

Requires Obsidian 1.7.2 or above: Web Clipper relies on features added to Obsidian URI in Obsidian 1.7.2. Please make sure you're using Obsidian 1.7.2 or above.

To save directly into your Obsidian vault, go to the extension options (right-click on the extension icon and select Extension options from the menu).

- In **General**, add one or more vault names in **Vault Management**.
- The top vault is your global default. Drag vaults to reorder, or use “Make Default” in the list.
- Configure **Default Folder** and **Default Filename** for fallback routing when a template does not define its own target.
- In **Templates**, set per-template default vault/folder/filename to auto-route different sessions.

For example, if you have an Obsidian vault name "MyNotes", want to keep your exported tab notes in a folder called "tabSidian" , and want to name each file "exported-tabs.md" with a timestamp, you would use the following settings:

- **Obsidian vault name**: MyNotes
- **Note path template**: tabSidian/exported-tabs-{timestamp}.md

This would save your tabs to your tabSidian folder inside your MyNotes vault. Each file would have a unique timestamp indicating the date and time when you saved them.

### Save all open tabs

1. Click the tabSidian toolbar button while the window you want to capture is focused.
2. tabSidian collects every tab in the current window (filtered by your restrictions) and renders them into Markdown using your active template.
3. Obsidian will open with your Markdown file selected.
4. Depending on your browser or if you haven't setup the **Obsidian vault name**:
   - Chrome/Edge/Firefox will prompt you to download the Markdown file or copy it to your clipboard.
   - Safari opens the Share Sheet; you can send the Markdown to Obsidian or copy/download it from the fallback buttons.

### Notes for non-Obsidian users

If you do not add a Vault name to your options, or don't have Obsidian installed, you can still save the markdown file to any folder in your system. In these cases, tabSidian will open a file download dialog so that you can select where to save the file.

A copy of the file contents will also be placed on the system clipboard and you can immediately paste it anywhere you want.

---

## Extension Options

### General

- **Vault Management**: Add one or more Obsidian vault names. If no vaults are configured, tabSidian will use download/share fallback instead of Obsidian URI.
- **Default Folder / Default Filename**: Global routing fallback when a template does not provide target values.
  - Use `{timestamp}` for unique filenames.
  - Apply `{date}` and `{time}` to insert your custom date/time formats.
  - Keep the `.md` extension.
- **Date format / Time format**: Customise the strings exposed as `{{{export.local.date}}}` and `{{{export.local.time}}}` in your templates.
  - Defaults remain `YYYY-MM-DD` and `HH:mm:ss` for backwards compatibility.
  - Supported tokens include `YYYY`, `YY`, `MMMM`, `MMM`, `MM`, `M`, `DD`, `D`, `dddd`, `ddd`, `HH`, `H`, `hh`, `h`, `mm`, `m`, `ss`, `s`, `A`, and `a`.

### Properties

- **Properties table**: Map each variable to a frontmatter field name and toggle whether it is enabled.
- **Import / Export `types.json`**: Move property mappings between setups and vaults.
- **Default title template**: Mustache template that builds the `title` field (e.g., `List of {{{export.tabCount}}} tabs saved on {{{export.local.date}}}`). This only adds a `title` field to the frontmatter; the actual filename is determined via **Note path template** in the **General** section.
- **Default tags**: One template per line. Use sections for conditional tags, e.g., `{{#window.incognito}}incognito{{/window.incognito}}` would add an `incognito` tag if you used tabSidian in a private browser window.
- **Collections or folders**: Another YAML array you can populate to help your PKM system route notes (e.g., `Research/{{{export.local.date}}}`).

### Templates

- **Sidebar template list**: Select built-in or custom templates from the left sidebar under Templates.
- **New template**: Create a custom template from the sidebar button.
- **Template editor**: Configure per-template routing and body:
  - Template Name
  - Default Vault (optional; overrides global default)
  - Default Folder (optional)
  - Default Filename (optional)
  - Content Body (Mustache)
- **Preview**: Shows sample output using neutral demo tab data.
- **Save/Delete**: Save template updates or remove custom templates.

Example block:
  ```mustache
  {{{frontmatter}}}
  {{#tabs}}
  ## {{title}}
  - {{url}}
  {{/tabs}}
  ```

#### Cool examples:

- Use `![{{hostname}}|32]({{favicon}})` to include each website's favicon as a graphic in your exported file. Change the `32` value to the size you want.
- Use `{{timestamps.lastAccessed}}` to show the last time you accessed a particular tab.

Sections and inverted sections let you include (`#`) or skip (`^`)chunks of Markdown depending on the captured data:

This code will only include the favicon it it's actually available:

```mustache
{{#favicon}}
![{{hostname}}|32]({{favicon}})
{{/favicon}}
```

This code will print `Last visited: unknown` if the last accessed time isn't available:

```mustache
{{^timestamps.lastAccessed}}
Last visited: unknown
{{/timestamps.lastAccessed}}
```

### Restricted URLs

- **Editor**: One substring per line. Any tab whose URL contains the substring is skipped.
- **Import/Export**: Maintain multiple lists (work, personal, etc.) and reload them as needed.
- **Why use it**: Keep sensitive or noisy pages (email, devtools, blank tabs) out of your exports.

---

## Popup Dialog

- Clicking the toolbar icon opens a save dialog (instead of immediately saving).
- Choose a template, adjust vault/folder/filename, and review a live Markdown preview.
- The action button reads **Add to Obsidian** when a vault is selected, and **Download Markdown** when no vault is selected.
- Manual vault/folder/filename edits are preserved while switching templates in the same popup session.

---

## Privacy

- tabSidian runs entirely in the browser. No browsing data or generated Markdown leaves your device.
- Permissions (tabs, clipboard, notifications, tab groups) are only used after you click the toolbar button.
- Clipboard access is required solely for the “copy Markdown” feature; nothing is captured unless you request it.
- tabSidian saves content locally to your Obsidian vault or to a folder of your choice. Your data is not collected, and we do not gather any usage metrics. The code is [open source](https://github.com/cgranier/tabSidian) and auditable.
