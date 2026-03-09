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
