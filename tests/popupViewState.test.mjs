import test from "node:test";
import assert from "node:assert/strict";
import {
  applyResolvedTargetWithOverrides,
  getKeyboardAction,
  getPreviewToggleView,
  getSaveActionLabel
} from "../src/popup/viewState.js";

test("getSaveActionLabel switches between Obsidian and download labels", () => {
  assert.equal(getSaveActionLabel("MyVault"), "Add to Obsidian");
  assert.equal(getSaveActionLabel(""), "Download Markdown");
});

test("applyResolvedTargetWithOverrides preserves manually edited values", () => {
  const result = applyResolvedTargetWithOverrides(
    {
      vault: "ManualVault",
      folder: "Manual/Folder",
      filename: "Manual.md"
    },
    {
      vault: "TemplateVault",
      folder: "Template/Folder",
      filename: "Template.md"
    },
    {
      vault: true,
      folder: false,
      filename: true
    }
  );

  assert.deepEqual(result, {
    vault: "ManualVault",
    folder: "Template/Folder",
    filename: "Manual.md"
  });
});

test("getPreviewToggleView returns expected text and aria state", () => {
  assert.deepEqual(getPreviewToggleView(false), {
    buttonLabel: "Hide",
    ariaExpanded: "true",
    previewCollapsedClass: false
  });
  assert.deepEqual(getPreviewToggleView(true), {
    buttonLabel: "Show",
    ariaExpanded: "false",
    previewCollapsedClass: true
  });
});

test("getKeyboardAction handles save and close shortcuts", () => {
  assert.equal(getKeyboardAction({ key: "Enter", ctrlKey: true, metaKey: false }), "save");
  assert.equal(getKeyboardAction({ key: "Enter", ctrlKey: false, metaKey: true }), "save");
  assert.equal(getKeyboardAction({ key: "Enter", ctrlKey: true, metaKey: false }, true), null);
  assert.equal(getKeyboardAction({ key: "Escape", ctrlKey: false, metaKey: false }), "close");
  assert.equal(getKeyboardAction({ key: "x", ctrlKey: false, metaKey: false }), null);
});
