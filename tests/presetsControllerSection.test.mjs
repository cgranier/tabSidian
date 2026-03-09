import test from "node:test";
import assert from "node:assert/strict";
import { createPresetsController } from "../src/options/sections/presetsController.js";

function createHarness() {
  const state = {
    customPresets: []
  };
  const status = [];
  let persistCalls = 0;
  let refreshCalls = 0;
  let saveCalls = 0;

  const controller = createPresetsController({
    elements: {
      importPresets: () => null,
      presetImportInput: () => null,
      exportPresets: () => null
    },
    state,
    normalizeCustomPreset: (candidate) => {
      if (!candidate || typeof candidate.name !== "string" || typeof candidate.template !== "string") {
        return null;
      }
      return {
        id: String(candidate.id ?? `custom:${candidate.name.toLowerCase()}`),
        name: candidate.name,
        template: candidate.template
      };
    },
    persistCustomPresets: async () => {
      persistCalls += 1;
    },
    refreshPresetPicker: () => {
      refreshCalls += 1;
    },
    queueSave: () => {
      saveCalls += 1;
    },
    setStatusMessage: (message, type) => {
      status.push({ message, type });
    }
  });

  return {
    controller,
    state,
    status,
    getPersistCalls: () => persistCalls,
    getRefreshCalls: () => refreshCalls,
    getSaveCalls: () => saveCalls
  };
}

test("importCustomPresetsFromFileList imports valid presets and saves", async () => {
  const { controller, state, status, getPersistCalls, getRefreshCalls, getSaveCalls } = createHarness();
  const file = {
    text: async () =>
      JSON.stringify({
        presets: [
          { id: "custom:work", name: "Work", template: "A" },
          { id: "custom:notes", name: "Notes", template: "B" }
        ]
      })
  };

  await controller.importCustomPresetsFromFileList([file]);

  assert.equal(state.customPresets.length, 2);
  assert.equal(getPersistCalls(), 1);
  assert.equal(getRefreshCalls(), 1);
  assert.equal(getSaveCalls(), 1);
  assert.equal(status.at(-1)?.type, "success");
});

test("exportCustomPresets reports error when no custom presets exist", () => {
  const { controller, status } = createHarness();
  controller.exportCustomPresets();
  assert.equal(status.at(-1)?.message, "There are no custom presets to export yet.");
  assert.equal(status.at(-1)?.type, "error");
});
