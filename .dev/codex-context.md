# Project Context

## Purpose
- Build and maintain tabSidian, a cross-browser extension that exports tabs to Obsidian-friendly Markdown and supports download/share fallbacks.
- Current implementation focus: PRD v3 Options + Popup UX, multi-vault routing, and regression-safe cross-browser behavior.

## Environment
- Node 18+ minimum; current local workflow validated on Node 24 via `nvm`.
- Recommended shell prefix for local commands:
  - `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null`
- Primary validation commands:
  - `npm test`
  - `npm run build:chrome`
  - `npm run ci`

## Key Commands
- Install deps: `npm install`
- Build all targets: `npm run build:all`
- Validate manifests: `npm run validate:manifests`
- Compatibility tests: `npm run test:compat`
- CI gate: `npm run ci`

## Important Files
- Main orchestrators:
  - `src/background/index.js`
  - `src/options/index.js`
  - `src/popup/index.js`
- Options architecture modules:
  - `src/options/sections/*.js`
- Popup view state helpers:
  - `src/popup/viewState.js`
- Shared platform logic:
  - `src/platform/storage.js`
  - `src/platform/saveTarget.js`
  - `src/platform/pathTemplate.js`
  - `src/platform/markdown.js`
- Popup behavior tests:
  - `tests/popupViewState.test.mjs`

## Constraints
- Must preserve cross-browser behavior (Chrome/Firefox/Edge/Safari targets).
- Must keep manifest validation and tests passing before handoff/commit.
- Avoid regressing fallback flows:
  - Obsidian protocol failure -> Markdown download/share fallback.
- Popup host sizing is browser-sensitive; fixed popup dimensions are currently used to prevent collapse/overflow regressions.

## Conventions
- Refactor in small slices with test/build validation after each slice.
- Keep `src/options/index.js` as orchestration layer; move domain logic into section controllers/state modules.
- Add focused unit tests for new modules or bugfix regressions.

## Open Questions
- Should popup preview start collapsed by default, or remain expanded for first-time discoverability?
- Should we add end-to-end popup UI tests (Playwright-style) to protect against host rendering regressions?
