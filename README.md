# tabSidian

tabSidian turns the tabs in your current browser window into an Obsidian-friendly Markdown document. The codebase now targets Chromium, Firefox, and Safari browsers from a single shared source tree using a Rollup build system and `webextension-polyfill`.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Development Setup](#development-setup)
- [Build Targets](#build-targets)
- [Automated Quality Gates](#automated-quality-gates)
- [Signing & Publishing](#signing--publishing)
- [Tips & Limitations](#tips--limitations)
- [Author](#author)

## Features

- Export focused window tabs to Markdown with frontmatter timestamps.
- Restrict specific URLs (settings pages, mail, etc.) and skip pinned tabs automatically.
- Customize Markdown templates with presets from the options page.
- Browser-aware download handling: standard downloads on Chromium/Firefox and Share Sheet integration on Safari.
- Deterministic multi-browser builds from a unified codebase via Rollup.

## Installation

Get the tabSidian extension from the official directory for your browser:

- **[Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tabsidian/gdnfbdjmfnpnjccfbppkbpjlpnppinba)**: For Microsoft Edge.
- **[Chrome Web Store](https://chromewebstore.google.com/detail/tabsidian/khooafbfmbbcjcbbfdkpceobdkdgpoic)**: For Chrome, Brave, Arc, Orion, and other Chromium-based browsers.
- **[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tabsidian/)**: For Firefox.
- **[Safari Extensions](placeholder)**: For macOS, iOS, and iPadOS. - Coming soon.

Download or install the version for your browser, then pin the tabSidian icon if you want quick access from the toolbar.

Manual installation remains supported for development or side-loading builds:

1. Clone the repository and install dependencies (`npm install`).
2. Run `npm run build:<browser>` (see [Build Targets](#build-targets)).
3. Load the generated `dist/<browser>` folder as an unpacked extension for your browser (e.g., `chrome://extensions`, `edge://extensions`, `about:debugging#/runtime/this-firefox`).

Latest packaged release: [tabSidian 2.0.0](versions/tabSidian_2.0.0.zip)

## Usage

1. Click the tabSidian toolbar icon.
2. The extension reads the active window, filters restricted or pinned tabs, and formats each one using your Markdown template.
3. Chromium/Firefox trigger a download prompt. Safari opens the Share Sheet and falls back to copy/download helpers if sharing is cancelled.
4. Manage restricted URLs and Markdown presets from the extension options page.

### Template customization

The options page now ships with a sandboxed Mustache renderer. Templates can reference:

- All settings auto-save as you edit within the General, Properties, Templates, and Restricted URLs panels; each panel also has its own “Reset” button plus a global reset.

- `{{{frontmatter}}}`, `{{export.iso}}`, `{{export.filename}}`, and `{{export.tabCount}}` for export metadata.
- Flip the switches in the Properties panel to decide which frontmatter keys ship with each export; turn them all off to drop the frontmatter block entirely.
- Frontmatter keys are configurable in the options UI; the active names are exposed via `{{frontmatterFields.title}}`, `{{frontmatterFields.date}}`, `{{frontmatterFields.time}}`, `{{frontmatterFields.exportedAt}}`, `{{frontmatterFields.tabCount}}`, `{{frontmatterFields.tags}}`, `{{frontmatterFields.collections}}`, and `{{frontmatterFields.windowIncognito}}`.
- `{{window.title}}`, `{{window.id}}`, `{{window.focused}}`, and `{{window.incognito}}` for window context.
- Tabs include group metadata when available: `{{groupTitle}}`, `{{group.color}}`, `{{group.colorHex}}`, etc., and you can iterate groups via `{{#groups}}...{{/groups}}`. (Firefox currently omits this API, so grouped headings will only appear on Chromium-based browsers.)
- Inside `{{#tabs}}...{{/tabs}}`, use `{{title}}`, `{{url}}`, `{{hostname}}`, `{{origin}}`, `{{protocol}}`, `{{pathname}}`, `{{search}}`, and `{{hash}}`.
- Each tab exposes booleans such as `{{active}}`, `{{highlighted}}`, `{{pinned}}`, `{{audible}}`, `{{muted}}`, `{{discarded}}`, and `{{incognito}}`, plus `{{favicon}}` and positional helpers `{{index}}` / `{{position}}`.
- Timestamp helpers live under `{{timestamps.lastAccessed}}` (ISO) and `{{timestamps.lastAccessedRelative}}` (human friendly).

Use sections (`{{#favicon}}...{{/favicon}}`) to conditionally render details, and inverted sections (`{{^timestamps.lastAccessed}}`) for fallbacks. Triple mustaches (`{{{value}}}`) bypass HTML escaping—only use them when you trust the output.

## Development Setup

- Requires Node.js 18+ (CI runs on Node 20).
- Install dependencies once: `npm install`.
- Helpful scripts:
  - `npm run build:chrome|firefox|edge|safari` – build a specific target into `dist/<target>`.
  - `npm run build:all` – build every supported browser.
  - `npm run validate:manifests` – generate and schema-validate manifests for all targets.
  - `npm test` – run compatibility tests (Node test runner).
  - `npm run ci` – convenience aggregator used by CI (`build:all`, `validate:manifests`, tests).

Source layout:

- `src/background` – service worker entry point using runtime/browser shims.
- `src/options` – options UI, styles, and logic shared across browsers.
- `src/platform` – shared helpers for defaults, Markdown formatting, download/share flows, and browser detection.
- `src/share` – Safari Share Sheet bridge with manual fallbacks.
- `config/targets.js` – per-browser manifest overrides and Rollup replacements.
- `scripts/` – build, clean, and manifest validation utilities.
- `tests/` – automated compatibility tests.

## Build Targets

Running `npm run build:<browser>` outputs a ready-to-package directory under `dist/<browser>`:

- `dist/chrome` – Chrome Web Store package (downloads permission).
- `dist/edge` – Microsoft Edge Add-ons package with `browser_specific_settings.edge` metadata.
- `dist/firefox` – AMO package with `browser_specific_settings.gecko` metadata and a Manifest V2 background script (Firefox service workers remain optional in stable builds).
- `dist/safari` – Safari Web Extension bundle using Share Sheet mode (downloads permission moved to optional).

Each build contains compiled scripts (`background.js`, `options.js`, `share.js`), copied assets, and a manifest tailored to the target.

## Automated Quality Gates

- The schema at `schemas/manifest.v3.base.json` enforces manifest structure across targets via `npm run validate:manifests`.
- Node test suites in `tests/` cover manifest overrides, tab filtering logic, and Markdown generation.
- GitHub Actions workflow `.github/workflows/ci.yml` runs the full build/validate/test pipeline on pushes and pull requests.

## Signing & Publishing

Follow the steps below after running the relevant `npm run build:<browser>` command.

### Chrome Web Store

- Zip the `dist/chrome` directory (`zip -r tabsidian-chrome.zip dist/chrome/*`).
- Upload through the Chrome Web Store Developer Dashboard.
- Provide release notes and request review; monitor the dashboard for approval status.

### Microsoft Edge Add-ons

- Zip the `dist/edge` directory.
- Submit via the Microsoft Partner Center (Edge Add-ons) portal, reusing Chrome assets when possible.
- Edge can ingest Chrome Web Store items; keep version numbers aligned to simplify parity releases.

### Mozilla Add-ons (AMO)

- Zip `dist/firefox`.
- Submit through https://addons.mozilla.org/developers/, selecting “This add-on is listed” for public releases.
- AMO performs automated validation and manual review. Address flagged issues before resubmitting.

### Safari App Extension

- Use `dist/safari` as the WebExtension payload when creating a Safari Web Extension App in Xcode.
- In Xcode, enable the `Share` entitlement if you rely on the Share Sheet fallback.
- Increment the Xcode project version alongside the manifest version (`2.0.0`) before archiving.
- Export a signed `.pkg` or submit directly to App Store Connect for notarisation and distribution.

## Tips & Limitations

- Only the currently focused window is exported; repeat the action for other windows.
- Multiple highlighted tabs export only the selection.
- Safari share integration stores temporary payloads in `browser.storage.local` until the share flow completes.
- Permissions remain minimal (`tabs`, `storage`, `downloads` (Chromium/Firefox)), with the downloads permission optional on Safari builds.

## Author

- Created by [Carlos Granier](https://x.com/cgranier) in Miami, FL.
- Original build story: [How I built tabSidian from scratch with GPT-4](https://github.com/cgranier/tabSidian/wiki/How-I-built-tabSidian-from-scratch-with-GPT-4).

Community contributions are welcome via pull requests—see the automatic checks above to match the expected workflow.
