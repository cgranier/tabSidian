import test from "node:test";
import assert from "node:assert/strict";
import { createResetController } from "../src/options/sections/resetController.js";

function createHarness() {
  const state = {
    frontmatterFields: {},
    frontmatterEnabled: {},
    frontmatterValidation: { hasErrors: true, messages: ["x"] },
    frontmatterListValidation: { hasErrors: true, messages: ["y"] },
    customPresets: [{ id: "custom:1", name: "A", template: "T" }],
    selectedPresetId: "custom:1"
  };
  const markdownInput = { value: "old" };
  const presetNameInput = { value: "name" };
  const restrictedInput = { value: "" };
  const status = [];
  const queue = [];
  let refreshCalled = false;
  let updatePreviewCalls = 0;
  let persistCalls = 0;

  const controller = createResetController({
    elements: {
      markdownFormat: () => markdownInput,
      presetName: () => presetNameInput,
      restrictedUrls: () => restrictedInput,
      resetProperties: () => null,
      resetTemplates: () => null,
      resetRestricted: () => null,
      resetAll: () => null
    },
    state,
    defaults: {
      markdownFormat: "DEFAULT",
      restrictedUrls: ["a.com", "b.com"],
      frontmatterFields: { title: "title" },
      frontmatterEnabledFields: { title: true },
      frontmatterTitleTemplate: "{{title}}",
      frontmatterTagTemplates: ["tag"],
      frontmatterCollectionTemplates: ["collection"]
    },
    generalController: {
      resetGeneralPreferences: () => {}
    },
    setFrontmatterInputs: () => {},
    setFrontmatterToggles: () => {},
    setFrontmatterTemplateInputs: () => {},
    updateTemplatePreview: () => {
      updatePreviewCalls += 1;
    },
    persistCustomPresets: async () => {
      persistCalls += 1;
    },
    refreshPresetPicker: () => {
      refreshCalled = true;
    },
    toMultilineValue: (values) => values.join("\n"),
    queueSave: (options) => queue.push(options ?? {}),
    setStatusMessage: (message, type) => status.push({ message, type })
  });

  return {
    controller,
    state,
    markdownInput,
    presetNameInput,
    restrictedInput,
    status,
    queue,
    getRefreshCalled: () => refreshCalled,
    getUpdatePreviewCalls: () => updatePreviewCalls,
    getPersistCalls: () => persistCalls
  };
}

test("resetTemplatePreferences clears presets and restores default template", () => {
  const { controller, state, markdownInput, presetNameInput, getRefreshCalled, getUpdatePreviewCalls } = createHarness();
  controller.resetTemplatePreferences();
  assert.equal(markdownInput.value, "DEFAULT");
  assert.equal(state.customPresets.length, 0);
  assert.equal(state.selectedPresetId, "builtin:default");
  assert.equal(presetNameInput.value, "");
  assert.equal(getRefreshCalled(), true);
  assert.equal(getUpdatePreviewCalls(), 1);
});

test("resetRestrictedPreferences restores default restricted list", () => {
  const { controller, restrictedInput, status } = createHarness();
  controller.resetRestrictedPreferences();
  assert.equal(restrictedInput.value, "a.com\nb.com");
  assert.equal(status.at(-1)?.message, "Restricted URLs reset.");
});
