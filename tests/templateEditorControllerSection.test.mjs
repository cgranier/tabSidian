import test from "node:test";
import assert from "node:assert/strict";
import { createTemplateEditorController } from "../src/options/sections/templateEditorController.js";

function createHarness() {
  const statusMessages = [];
  let persistCalls = 0;
  let idCounter = 1;

  const state = {
    customPresets: [],
    selectedPresetId: "builtin:default",
    vaults: [{ id: "v1", name: "Main", isDefault: true }]
  };

  const fields = {
    name: { value: "My Template" },
    content: { value: "# {{title}}" },
    filename: { value: "Tabs - {{date}}" },
    folder: { value: "01-What" },
    vault: { value: "Main" }
  };

  const elements = {
    templateList: () => ({}),
    templateName: () => fields.name,
    templateContent: () => fields.content,
    templateFilename: () => fields.filename,
    templateFolder: () => fields.folder,
    templateVault: () => fields.vault,
    createTemplateBtn: () => null,
    saveTemplateBtn: () => null,
    deleteTemplateBtn: () => null
  };

  const builtIns = [{ id: "builtin:default", name: "Default", template: "x" }];

  const controller = createTemplateEditorController({
    elements,
    state,
    getAllPresets: () => [...builtIns, ...state.customPresets],
    getPresetById: (id) => [...builtIns, ...state.customPresets].find((preset) => preset.id === id) ?? null,
    createCustomTemplateId: () => `custom:${idCounter++}`,
    createDraftCustomTemplate: (template, createId) => ({
      id: createId(),
      name: "New Template",
      template,
      filenamePattern: "",
      targetFolder: "",
      targetVault: ""
    }),
    upsertCustomTemplatePresets: (presets, nextPreset) => {
      const index = presets.findIndex((entry) => entry.id === nextPreset.id);
      if (index === -1) {
        return { presets: [...presets, nextPreset], selectedId: nextPreset.id, created: true };
      }
      const updated = [...presets];
      updated[index] = nextPreset;
      return { presets: updated, selectedId: nextPreset.id, created: false };
    },
    removeCustomTemplatePresetById: (presets, id) => {
      const filtered = presets.filter((entry) => entry.id !== id);
      return { presets: filtered, removed: filtered.length !== presets.length };
    },
    applyTemplateToEditorForm: () => {},
    renderTemplateSidebarItems: () => {},
    persistCustomPresets: async () => {
      persistCalls += 1;
    },
    updateTemplatePreview: () => {},
    setStatusMessage: (message, type) => statusMessages.push({ message, type }),
    defaultMarkdownFormat: "Default Markdown"
  });

  return { controller, state, fields, statusMessages, getPersistCalls: () => persistCalls };
}

test("saveCurrentTemplate stores template and reports success", async () => {
  const { controller, state, getPersistCalls } = createHarness();

  await controller.saveCurrentTemplate();

  assert.equal(state.customPresets.length, 1);
  assert.equal(state.customPresets[0].name, "My Template");
  assert.equal(state.selectedPresetId, state.customPresets[0].id);
  assert.equal(getPersistCalls(), 1);
});

test("createNewTemplate creates draft and selects it", async () => {
  const { controller, state, getPersistCalls } = createHarness();

  await controller.createNewTemplate();

  assert.equal(state.customPresets.length, 1);
  assert.equal(state.selectedPresetId, state.customPresets[0].id);
  assert.equal(getPersistCalls(), 1);
});

test("deleteTemplate blocks deletion for built-in selection", async () => {
  const { controller, statusMessages, getPersistCalls } = createHarness();

  await controller.deleteTemplate();

  assert.equal(getPersistCalls(), 0);
  assert.equal(statusMessages.at(-1)?.message, "Cannot delete built-in templates.");
  assert.equal(statusMessages.at(-1)?.type, "error");
});
