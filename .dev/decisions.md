# Decisions

Architecture and product decisions will be documented here.

## 2026-03-09

- Phase 1 refactor is treated as stabilization baseline (commit `848100b`).
- Options template preview is required in the Options/Templates page (not popup-only).
- Preview sample dataset should remain neutral and non-product-specific (`example.com` style entries).
- Continue modularization direction: `src/options/index.js` should stay orchestration-focused.
- Phase 2 branch baseline is `codex/phase2-overhaul`; work continued there as the clean v3 implementation branch.
- Template titles remain in the options sidebar (not in the main template panel) to match reference UX and reduce clutter.
- Narrow-screen sidebar navigation remains vertically stacked; category order adjusted with `Templates` at bottom for readability.
- Popup layout uses fixed dimensions and internal scrolling with pinned footer to avoid browser popup host collapse/overflow regressions.
- Popup action wording follows routing state:
  - with vault: `Add to Obsidian`
  - without vault: `Download Markdown`
- Popup manual field overrides (vault/folder/filename) are preserved when switching templates within the same dialog session.

## 2026-09-28

- Obsidian export transport (issues #33, #16, #24):
  - `obsidian://new` URIs never combine `clipboard=true` with `content=`; `buildObsidianUrl` throws if asked to.
  - Inline `content=` is preferred; clipboard mode is used only when the inline URI exceeds the per-browser limit.
  - The clipboard is written only from extension context (popup or background page). Page-script clipboard injection was removed. No `clipboardRead` permission is requested, so there is no read-back; a failed write falls back to Markdown download.
  - The popup prepares the export via `PREPARE_EXPORT`, then performs the clipboard write and the active-tab `tabs.update` launch itself. The new-tab transport is delegated to the background (`LAUNCH_OBSIDIAN_NEW_TAB`) because activating a tab closes the popup.
  - Empty rendered exports abort; URL coverage is logged as a metric only, because custom templates may omit URLs.
