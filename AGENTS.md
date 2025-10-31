# AGENT BRIEFING — tabSidian

This document gives automation agents the minimum context needed to work effectively on the tabSidian browser extension codebase. Use it alongside `README.md`, `TODO.md`, and inline comments for deeper detail.

## Mission & Scope

- tabSidian exports the tabs from the user’s focused browser window into an Obsidian-friendly Markdown document.
- The shared source tree targets Chromium, Firefox, Edge, and Safari; Rollup plus `webextension-polyfill` build the variant-specific bundles.
- Key responsibilities include Markdown templating, browser-specific download/share flows, and manifest generation.

## Tech Stack

- Runtime: WebExtension APIs with `webextension-polyfill`.
- Bundler: Rollup (`rollup.config.js`) with per-browser replacements in `config/targets.js`.
- UI: Options page in vanilla JS (see `src/options/`), Mustache templating, and CSS modules.
- Tooling: Node 18+ (CI on Node 20), npm scripts, Node test runner (`npm test`).

## Repository Landmarks

- `src/background/` — background service worker logic and tab export orchestration.
- `src/options/` — options UI, state management, and templating sandbox.
- `src/platform/` — shared helpers for Markdown formatting, filename sanitisation, download/share handling, and per-browser quirks.
- `src/share/` — Safari Share Sheet bridge and fallbacks.
- `config/targets.js` — manifest overrides and build-time constants per browser.
- `scripts/` — build, clean, manifest validation scripts.
- `schemas/` — JSON Schema definitions used by manifest validation.
- `tests/` — Node-based compatibility tests for formatting, filtering, and manifest logic.

## Getting Started

```sh
npm install          # install dependencies
npm run build:all    # build every browser target into dist/
npm test             # run automated compatibility tests
npm run ci           # aggregate build:all + validate:manifests + tests
```

Common single-target builds:

- `npm run build:chrome`
- `npm run build:firefox`
- `npm run build:edge`
- `npm run build:safari`

Artifacts land in `dist/<browser>`; zipped releases live under `versions/`.

## Quality & Validation

- Linting is not enforced; focus on passing tests (`npm test`) and manifest validation (`npm run validate:manifests`).
- CI (GitHub Actions) runs `npm run ci`; mirror those checks locally for deterministic results.
- When touching templates or manifest logic, add or update tests in `tests/` as needed.

## Implementation Tips

- Follow existing Mustache patterns in `src/options/templates` when introducing new template placeholders or defaults.
- Honor per-browser capability gaps (e.g., tab group APIs absent in Firefox) by guarding with feature detection.
- Keep exports deterministic: timestamp formatting, filename sanitisation, and tab ordering are sensitive to regressions.
- Safari share logic must preserve fallback flows for cancellation or unavailable share targets.
- When adding config, reflect defaults in both UI (`src/options/`) and shared helpers (`src/platform/`).

## Resources

- `README.md` — user-facing overview, installation, and build instructions.
- `TODO.md` — backlog and future enhancements.
- `docs/HELP.md` — end-user usage guide; sync wording if behaviour changes.
- `repomix-output.txt` — aggregated file metrics (useful for quick inventory).

Agents should document significant behavioural changes in `README.md` and update relevant tests to maintain coverage. Review existing automation before adding new tooling to avoid duplication.
